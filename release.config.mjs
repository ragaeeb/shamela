export default {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        [
            '@semantic-release/npm',
            {
                npmPublish: true,
            },
        ],
        [
            '@semantic-release/github',
            {
                failComment: false,
                successComment: false,
            },
        ],
        [
            '@semantic-release/git',
            {
                assets: ['package.json'],
                message: 'chore(release): ${nextRelease.version} [skip ci]',
            },
        ],
    ],
    tagFormat: 'v${version}',
};
