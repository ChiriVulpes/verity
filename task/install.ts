import { Task } from 'task'

export default Task('install', async task => {
	await task.install(
		{
			path: '.',
			dependencies: {
				task: { repo: 'chirivulpes/task', branch: 'package' },
				lint: { repo: 'fluff4me/lint' },
				chiri: { repo: 'fluff4me/chiri', branch: 'package' },
				weaving: { repo: 'chirivulpes/weaving', branch: 'package' },
			},
		},
		{
			path: 'src',
			dependencies: {
				'kitsui': { repo: 'fluff4me/kitsui', branch: 'package' },
			},
		},
	)
})
