module.exports = {
    apps: [
        {
            name: 'discord-enxada',
            script: 'dist/Main.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            node_args: '--env-file=.env',
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
