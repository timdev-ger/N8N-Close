import { getSavedSearchEntries } from '../CloseSavedSearchTrigger.node';

describe('CloseSavedSearchTrigger membership tracking', () => {
	it('does not emit leads already in the saved search on the first poll', () => {
		const result = getSavedSearchEntries([{ id: 'lead_a' }, { id: 'lead_b' }], [], false);

		expect(result.entries).toEqual([]);
		expect(result.currentLeadIds).toEqual(['lead_a', 'lead_b']);
	});

	it('emits only leads that entered since the preceding poll', () => {
		const result = getSavedSearchEntries([{ id: 'lead_a' }, { id: 'lead_b' }], ['lead_a'], true);

		expect(result.entries).toEqual([{ id: 'lead_b' }]);
	});

	it('emits a lead again after it left and re-entered the saved search', () => {
		const afterLeaving = getSavedSearchEntries([], ['lead_a'], true);
		const afterReEntering = getSavedSearchEntries(
			[{ id: 'lead_a' }],
			afterLeaving.currentLeadIds,
			true,
		);

		expect(afterReEntering.entries).toEqual([{ id: 'lead_a' }]);
	});
});
