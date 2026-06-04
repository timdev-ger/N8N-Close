module.exports = {
	testEnvironment: 'node',
	roots: ['<rootDir>/nodes', '<rootDir>/credentials'],
	testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
	transform: {
		'^.+\\.ts$': ['@swc/jest', {
			jsc: {
				parser: { syntax: 'typescript', decorators: true },
				target: 'es2019',
			},
		}],
	},
	collectCoverageFrom: ['**/*.ts', '!**/*.d.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1',
	},
};