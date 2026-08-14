import type {
	IDataObject,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	ILoadOptionsFunctions,
	NodeConnectionType,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

import { closeApiRequest } from './GenericFunctions';

type Lead = IDataObject & { id?: unknown };

type SavedSearch = IDataObject & {
	type?: unknown;
	s_query?: unknown;
};

type SavedSearchTriggerState = {
	initializedBySavedSearchId?: Record<string, boolean>;
	leadIdsBySavedSearchId?: Record<string, string[]>;
};

export function getSavedSearchEntries(
	leads: Lead[],
	previousLeadIds: string[],
	isInitialized: boolean,
): { entries: Lead[]; currentLeadIds: string[] } {
	const currentLeadIds = leads
		.map((lead) => lead.id)
		.filter((id): id is string => typeof id === 'string');

	if (!isInitialized) {
		return { entries: [], currentLeadIds };
	}

	const previousLeadIdSet = new Set(previousLeadIds);
	return {
		entries: leads.filter((lead) => typeof lead.id === 'string' && !previousLeadIdSet.has(lead.id)),
		currentLeadIds,
	};
}

export class CloseSavedSearchTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Close CRM Saved Search Trigger',
		name: 'closeSavedSearchTrigger',
		icon: 'file:close.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["savedSearchId"]}}',
		description: 'Starts the workflow when a lead enters a Close CRM saved search',
		defaults: {
			name: 'Close CRM Saved Search Trigger',
		},
		inputs: [],
		outputs: [{ type: 'main' as NodeConnectionType }],
		credentials: [
			{
				name: 'closeApi',
				required: true,
			},
		],
		polling: true,
		properties: [
			{
				displayName: 'Saved Search',
				name: 'savedSearchId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSavedSearches',
				},
				default: '',
				required: true,
				description:
					'The Close CRM saved search to monitor. Its saved query and filters determine which leads are members.',
			},
			{
				displayName: 'Trigger Existing Leads on First Poll',
				name: 'emitExistingOnFirstPoll',
				type: 'boolean',
				default: false,
				description:
					'Whether to trigger for leads already in the saved search when the workflow is first activated',
			},
		],
	};

	methods = {
		loadOptions: {
			async getSavedSearches(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await closeApiRequest.call(
					this,
					'GET',
					'/saved_search/',
					{},
					{ type: 'lead' },
				);
				return (response.data as SavedSearch[]).map((savedSearch) => ({
					name: String(savedSearch.name ?? savedSearch.id),
					value: String(savedSearch.id),
				}));
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const savedSearchId = this.getNodeParameter('savedSearchId') as string;
		const emitExistingOnFirstPoll = this.getNodeParameter('emitExistingOnFirstPoll') as boolean;
		const state = this.getWorkflowStaticData('node') as SavedSearchTriggerState;
		const initializedBySavedSearchId = state.initializedBySavedSearchId ?? {};
		const leadIdsBySavedSearchId = state.leadIdsBySavedSearchId ?? {};
		const currentLeads: Lead[] = [];
		const savedSearch = (await closeApiRequest.call(
			this,
			'GET',
			`/saved_search/${savedSearchId}/`,
		)) as SavedSearch;

		if (savedSearch.type !== 'lead') {
			throw new NodeOperationError(this.getNode(), 'The selected saved search must be a lead search');
		}

		if (!savedSearch.s_query || typeof savedSearch.s_query !== 'object') {
			throw new NodeOperationError(
				this.getNode(),
				'The selected saved search does not contain a valid search query',
			);
		}

		const searchQuery = { ...(savedSearch.s_query as IDataObject) };
		delete searchQuery.cursor;
		let cursor: string | undefined;

		do {
			const body: IDataObject = {
				...searchQuery,
				_limit: 100,
			};
			if (cursor) {
				body.cursor = cursor;
			}
			const response = await closeApiRequest.call(this, 'POST', '/data/search/', body);
			const page = Array.isArray(response.data) ? (response.data as Lead[]) : [];
			currentLeads.push(...page);
			cursor = typeof response.cursor === 'string' ? response.cursor : undefined;
		} while (cursor);

		const isInitialized = initializedBySavedSearchId[savedSearchId] === true;
		const { entries, currentLeadIds } = getSavedSearchEntries(
			currentLeads,
			leadIdsBySavedSearchId[savedSearchId] ?? [],
			isInitialized,
		);

		initializedBySavedSearchId[savedSearchId] = true;
		leadIdsBySavedSearchId[savedSearchId] = currentLeadIds;
		state.initializedBySavedSearchId = initializedBySavedSearchId;
		state.leadIdsBySavedSearchId = leadIdsBySavedSearchId;

		const output = (!isInitialized && emitExistingOnFirstPoll ? currentLeads : entries).filter(
			(lead) => typeof lead.id === 'string',
		);
		if (output.length === 0) {
			return null;
		}

		const leads: IDataObject[] = [];
		for (const lead of output) {
			leads.push(await closeApiRequest.call(this, 'GET', `/lead/${lead.id}/`));
		}
		return [this.helpers.returnJsonArray(leads)];
	}
}
