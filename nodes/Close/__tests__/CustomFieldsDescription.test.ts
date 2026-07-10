jest.mock('../GenericFunctions', () => ({
	closeApiRequestAllItems: jest.fn(),
	closeApiRequest: jest.fn(),
}));

import {
	customFieldsLoadMethods,
	getCachedCustomActivityCustomFields,
} from '../descriptions/CustomFieldsDescription';
import { closeApiRequestAllItems, closeApiRequest } from '../GenericFunctions';

describe('CustomFieldsDescription cache isolation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('isolates lead custom field cache per connected account', async () => {
		(closeApiRequestAllItems as jest.Mock).mockImplementation(async function () {
			const credentials = await this.getCredentials('closeApi');
			return [
				{
					id: `cf_${credentials.apiKey}`,
					name: `Field ${credentials.apiKey}`,
					type: 'text',
					accepts_multiple_values: false,
				},
			];
		});

		const accountAContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'api-key-a' }),
			getNodeParameter: jest.fn().mockReturnValue('lead'),
		};
		const accountBContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'api-key-b' }),
			getNodeParameter: jest.fn().mockReturnValue('lead'),
		};

		const fieldsA = await customFieldsLoadMethods.getTextFields(accountAContext);
		const fieldsB = await customFieldsLoadMethods.getTextFields(accountBContext);
		const fieldsASecondCall = await customFieldsLoadMethods.getTextFields(accountAContext);

		expect(fieldsA).toEqual([{ name: 'Field api-key-a', value: 'cf_api-key-a' }]);
		expect(fieldsB).toEqual([{ name: 'Field api-key-b', value: 'cf_api-key-b' }]);
		expect(fieldsASecondCall).toEqual([{ name: 'Field api-key-a', value: 'cf_api-key-a' }]);
		expect(closeApiRequestAllItems).toHaveBeenCalledTimes(2);
	});

	it('isolates custom activity field cache per connected account', async () => {
		(closeApiRequest as jest.Mock).mockImplementation(async function () {
			const credentials = await this.getCredentials('closeApi');
			return {
				fields: [
					{
						id: `cf_${credentials.apiKey}`,
						name: `Activity Field ${credentials.apiKey}`,
						type: 'text',
						multiple: false,
					},
				],
			};
		});

		const accountAContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'activity-key-a' }),
		};
		const accountBContext = {
			getCredentials: jest.fn().mockResolvedValue({ apiKey: 'activity-key-b' }),
		};

		const fieldsA = await getCachedCustomActivityCustomFields(accountAContext, 'cat_1');
		const fieldsB = await getCachedCustomActivityCustomFields(accountBContext, 'cat_1');
		const fieldsASecondCall = await getCachedCustomActivityCustomFields(accountAContext, 'cat_1');

		expect(fieldsA).toEqual([
			{
				id: 'cf_activity-key-a',
				name: 'Activity Field activity-key-a',
				type: 'text',
				accepts_multiple_values: false,
				choices: undefined,
			},
		]);
		expect(fieldsB).toEqual([
			{
				id: 'cf_activity-key-b',
				name: 'Activity Field activity-key-b',
				type: 'text',
				accepts_multiple_values: false,
				choices: undefined,
			},
		]);
		expect(fieldsASecondCall).toEqual(fieldsA);
		expect(closeApiRequest).toHaveBeenCalledTimes(2);
	});
});
