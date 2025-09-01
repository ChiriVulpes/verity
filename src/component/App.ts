import Button from 'component/core/Button'
import BaseCard from 'component/core/Card'
import Image from 'component/core/Image'
import Lore from 'component/core/Lore'
import Paragraph from 'component/core/Paragraph'
import { Component, State } from 'kitsui'
import Slot from 'kitsui/component/Slot'
import FocusListener from 'kitsui/utility/FocusListener'
import InputBus from 'kitsui/utility/InputBus'

export default Component(component => {
	const app = component.style('app')

	Component()
		.style('app-header')
		.append(Component()
			.style('app-header-title')
			.text.set(quilt => quilt['title']())
		)
		.append(Component()
			.style('app-header-subtitle')
			.text.set(quilt => quilt['subtitle']())
		)
		.appendTo(app)

	////////////////////////////////////
	//#region Reset

	const resetting = State(false)
	let resetTimeout: number | undefined

	component.style.bind(resetting, 'app--resetting')

	InputBus.event.subscribe('Down', (event, input) => {
		if (input.use('Escape') && (InputBus.getPressDuration('Escape') ?? 0) < 300) {
			resetting.value = true
			window.setTimeout(reset, 500)
		}
	})

	InputBus.event.subscribe('Up', (event, input) => {
		if (input.use('Escape')) {
			resetting.value = false
			window.clearTimeout(resetTimeout)
		}
	})

	const onReset: (() => void)[] = []
	function reset () {
		resetting.value = false
		for (const fn of onReset)
			fn()
	}

	const resetPredicates: (() => boolean)[] = []
	function isReset () {
		return resetPredicates.every(fn => fn())
	}

	//#endregion
	////////////////////////////////////

	type Shape2D =
		| 'orbicular'
		| 'quadrate'
		| 'trigon'

	type Shape3D =
		| 'cuboid'
		| 'spheric'
		| 'pyramidic'
		| 'conoid'
		| 'cylindric'
		| 'trilateral'

	////////////////////////////////////
	//#region Cards

	type CardState = 'complete' | 'modified' | 'reset'
	interface CardExtensions {
		getState (): CardState
	}

	interface Card extends BaseCard, CardExtensions { }

	const cards: Card[] = []
	const Card = Component((component, getState: () => CardState): Card => {
		const card = component.and(BaseCard)
			.style('app-card')
			.tabIndex('auto')
			.appendTo(app)
			.extend<CardExtensions>(card => ({
				getState,
			}))
		InputBus.event.subscribe('Down', (event, input) => {
			if (!card.contains(input.targetElement))
				return

			if (input.targetElement?.closest('label, button, input'))
				return

			if (input.use('MouseLeft'))
				FocusListener.focus(card.element, true)
		})
		card.header.style('app-card-header')
		card.style.bind(card.hasFocused, 'app-card--focus')
		cards.push(card)
		return card
	})

	function nextCard () {
		const focusedCardIndex = cards.findIndex(card => card.hasFocused.value)
		const nextCard = cards[focusedCardIndex + 1] || cards[0]
		nextCard.focus()
	}

	onReset.push(() => cards[0].focus())
	resetPredicates.push(() => cards.every(card => card.getState() === 'reset'))

	app.onRooted(() => {
		InputBus.event.subscribe('Down', (event, input) => {
			if (cards.some(card => card.hasFocused.value))
				return

			if (!input.use('MouseLeft'))
				return

			if (isReset()) {
				cards[0].focus()
				return
			}

			for (const card of cards)
				if (card.getState() !== 'complete') {
					card.focus()
					return
				}
		})
	})

	//#endregion
	////////////////////////////////////

	////////////////////////////////////
	//#region Callout Components

	interface CalloutButtonExtensions {
		readonly state: State<boolean>
		select (): void
		deselect (): void
		toggle (selected: boolean): void
	}

	interface CalloutButton extends Component, CalloutButtonExtensions { }

	const CalloutButton = Component((component, shape: Shape, name: string): CalloutButton => {
		const checked = State(false)
		const radio = Component('input')
			.attributes.set('type', 'radio')
			.attributes.set('name', name)
			.style('callout-button-checkbox')
			.event.subscribe('change', (event, { recursive }: { recursive: boolean } = { recursive: false }) => {
				checked.value = event.host.element.checked
				if (recursive)
					return

				const radioButtonsWithSameName = document.querySelectorAll(`input[type="radio"][name="${name}"]`)
				for (const button of radioButtonsWithSameName)
					if (button !== event.host.element)
						(button.component?.event as { emit (...args: any): any }).emit('change', { recursive: true })
			})
		return component.replaceElement('label')
			.and(Button)
			.style('callout-button')
			.style.bind(checked, 'callout-button--checked')
			.append(radio)
			.append(Image(`/static/image/${shape}.png`)
				.style('callout-button-image')
			)
			.extend<CalloutButtonExtensions>(calloutButton => ({
				state: checked,
				select () {
					checked.value = true
					radio.element.checked = true
				},
				deselect () {
					checked.value = false
					radio.element.checked = false
				},
				toggle (selected) {
					if (selected)
						calloutButton.select()
					else
						calloutButton.deselect()
				},
			}))
	})

	interface CalloutExtensions<SHAPE extends Shape> {
		readonly state: State<SHAPE | undefined>
		select (shape: SHAPE): void
	}

	interface Callout<SHAPE extends Shape> extends Component, CalloutExtensions<SHAPE> { }

	const Callout = Component((component, options: Shape[]): Callout<Shape> => {
		const name = Math.random().toString(36).slice(2)
		const state = State<Shape | undefined>(undefined)
		const map = new Map(options.map(option => [option, CalloutButton(option, name)
			.tweak(button => button.state.subscribeManual(checked => checked && (state.value = option))),
		]))
		return component.style('callout')
			.style.setVariable('callout-button-option-count', options.length)
			.append(Component()
				.style('callout-button-list')
				.append(...map.values())
			)
			.append(Component()
				.style('callout-label')
				.style.bind(state.mapManual(state => !state ? false : shadowDupes[shadowLetterMap[state as Shape2D]] || truthDupes[reverse3DMap[state as Shape3D]]), 'callout-label--dupe')
				.text.bind(state.mapManual(state => !state ? '\xa0' : quilt => quilt[`shape/${state}`]()))
			)
			// .append(Component()
			// 	.style('callout-preview')
			// 	.appendWhen(state.truthy, Image(state.mapManual(state => `/static/image/${state}.png`)))
			// )
			.extend<CalloutExtensions<Shape>>(callout => ({
				state,
				select (shape?: Shape): void {
					state.value = shape
					for (const [option, button] of map)
						button.toggle(option === shape)
				},
			}))
	})

	//#endregion
	////////////////////////////////////

	////////////////////////////////////
	//#region Shadows

	type CalloutLetter = 's' | 't' | 'c'
	type CalloutLetterOptional = CalloutLetter | ' '
	type Shape = Shape2D | Shape3D

	type CalloutString = `${CalloutLetterOptional}${CalloutLetterOptional}${CalloutLetterOptional}`

	const shadowCalloutMap = { s: 'quadrate', c: 'orbicular', t: 'trigon' } satisfies Record<CalloutLetter, Shape2D>
	const shadowLetterMap = { quadrate: 's', orbicular: 'c', trigon: 't' } satisfies Record<Shape2D, CalloutLetter>

	const typedShadowCallout = State('')
	const shadowCallout = State<CalloutString>('   ')
	onReset.push(() => {
		typedShadowCallout.value = ''
		shadowCallout.value = '   '
	})

	const shadowDupes = Object.fromEntries((Object.keys(shadowCalloutMap) as CalloutLetter[])
		.map(letter => [letter, getShadowDupedState(letter)])
	) as Record<CalloutLetter, State.Generator<boolean>>
	function getShadowDupedState (letter: CalloutLetter) {
		return shadowCallout.mapManual(callout => [...callout].filter(l => l === letter).length > 1)
	}
	const hasShadowDupe = State.MapManual(Object.values(shadowDupes), (...dupeBools) => dupeBools.includes(true))

	const mode = State<'oqt' | 'cst'>('cst')

	const randomExampleShadowsCallout = ['cst', 'cts', 'sct', 'stc', 'tsc', 'tcs'][Math.floor(Math.random() * 6)]
	const getShadowsState = (): CardState => (
		typedShadowCallout.value === '' && shadowCallout.value === '   ' ? 'reset'
			: shadowCallout.value.replaceAll(' ', '').length === 3 ? 'complete'
				: 'modified'
	)
	const shadowsCard = Card(getShadowsState)
		.tweak(card => card.headerText.set(quilt => quilt['card/callout/title']()))
		.tweak(card => card.descriptionText.set(quilt => quilt['card/callout/description'](randomExampleShadowsCallout.toUpperCase())))
		.append(Component()
			.style('callout-text')
			.append(Slot().use(State.UseManual({ callout: shadowCallout, mode }), (slot, { callout, mode }) => {
				for (const letter of callout)
					Component()
						.style('callout-text-letter')
						.text.set(letter === ' ' ? '_' : mode === 'cst' ? letter : letter === 'c' ? 'o' : letter === 's' ? 'q' : letter)
						.style.bind(shadowDupes[letter as CalloutLetter], 'callout-text-letter--dupe')
						.appendTo(slot)
			}))
		)
		.append(Component()
			.style('callout-list')
			.append(Slot().use(shadowCallout.mapManual(callout => callout.length), (slot, length) => {
				for (let i = 0; i < length; i++) {
					const calloutSelector = (Callout(['orbicular', 'quadrate', 'trigon']) as Callout<Shape2D>).appendTo(slot)
					calloutSelector.state.useManual(selected => {
						const letter = selected && shadowLetterMap[selected]
						const newCalloutValue = (shadowCallout.value.slice(0, i) + (letter || ' ') + shadowCallout.value.slice(i + 1)) as CalloutString
						if (shadowCallout.value !== newCalloutValue) {
							shadowCallout.value = newCalloutValue
							typedShadowCallout.value = ''
						}
					})
					shadowCallout.use(calloutSelector, callout => calloutSelector.select(shadowCalloutMap[callout[i] as CalloutLetter]))
				}
			}))
		)

	InputBus.event.subscribe('Down', (event, input) => {
		if (!shadowsCard.hasFocused.value)
			return

		let modified = false
		let newCalloutValue = typedShadowCallout.value
		if (input.use('c') || input.use('C')) {
			mode.value = 'cst'
			newCalloutValue += 'c'
		}
		// if (input.use('o') || input.use('O')) {
		// 	mode.value = 'oqt'
		// 	newCalloutValue += 'c'
		// }

		if (input.use('s') || input.use('S')) {
			mode.value = 'cst'
			newCalloutValue += 's'
		}
		// if (input.use('q') || input.use('Q')) {
		// 	mode.value = 'oqt'
		// 	newCalloutValue += 's'
		// }

		if (input.use('t') || input.use('T'))
			newCalloutValue += 't'

		if (input.use('Backspace')) {
			modified = true
			newCalloutValue = shadowCallout.value.trimEnd().slice(0, -1).trimEnd()
		}

		newCalloutValue = newCalloutValue.slice(0, 3)
		if (typedShadowCallout.value !== newCalloutValue || modified) {
			typedShadowCallout.value = newCalloutValue
			shadowCallout.value = `${typedShadowCallout.value[0] as CalloutLetter || ' '}${typedShadowCallout.value[1] as CalloutLetter || ' '}${typedShadowCallout.value[2] as CalloutLetter || ' '}`
			if (shadowCallout.value.replaceAll(' ', '').length === 3)
				nextCard()
		}
	})

	//#endregion
	////////////////////////////////////

	////////////////////////////////////
	//#region Truths

	type Callout3D = `${CalloutLetter}${CalloutLetter}`
	type Callout3DOptional = Callout3D | '  '
	const callout3DMap: Record<Callout3D, Shape3D> = {
		ss: 'cuboid',
		cc: 'spheric',
		tt: 'pyramidic',
		sc: 'cylindric',
		cs: 'cylindric',
		tc: 'conoid',
		ct: 'conoid',
		ts: 'trilateral',
		st: 'trilateral',
	}
	const reverse3DMap = Object.fromEntries(Object.entries(callout3DMap)
		.map(([k, v]) => [v, k])
	) as Record<Shape3D, Callout3D>

	const typedTruthCallout = State('')
	const truthsCallout = State<[Callout3DOptional, Callout3DOptional, Callout3DOptional]>(['  ', '  ', '  '])
	onReset.push(() => {
		truthsCallout.value = ['  ', '  ', '  ']
	})

	const truthDupes = Object.fromEntries((Object.keys(callout3DMap) as Callout3D[])
		.map(callout => [callout, getTruthDupedState(callout)])
	) as Record<Callout3D, State.Generator<boolean>>
	function getTruthDupedState (truth: Callout3D) {
		return truthsCallout.mapManual(truths => {
			return [...truth].some(letter => truths.flatMap(callout => [...callout]).filter(l => l === letter).length > 2)
		})
	}
	const hasTruthDupe = State.MapManual(Object.values(truthDupes), (...dupeBools) => dupeBools.includes(true))

	const getTruthState = (): CardState => (
		typedTruthCallout.value === '' && truthsCallout.value.every(callout => callout === '  ') ? 'reset'
			: truthsCallout.value.flatMap(callout => [...callout]).filter(l => l !== ' ').length === 6 ? 'complete'
				: 'modified'
	)
	const truthsCard = Card(getTruthState)
		.tweak(card => card.headerText.set(quilt => quilt['card/truth/title']()))
		.tweak(card => card.descriptionText.set(quilt => quilt['card/truth/description']()))
		.append(Component()
			.style('callout-text', 'callout-text--doubled')
			.append(Slot().use(truthsCallout, (slot, truths) => {
				for (const callout of truths) {
					Component()
						.style('callout-text-letter', 'callout-text-letter--doubled')
						.append(...callout.split('').map(letter => Component()
							.style('callout-text-letter')
							.text.set(letter === ' ' ? '_' : letter)
						))
						.style.bind(truthDupes[callout as Callout3D] || false, 'callout-text-letter--dupe')
						.appendTo(slot)
				}
			}))
		)
		.append(Component()
			.style('callout-list')
			.append(Slot().use(shadowCallout.mapManual(callout => callout.length), (slot, length) => {
				for (let i = 0; i < length; i++) {
					const calloutSelector = (Callout(['spheric', 'cuboid', 'pyramidic', 'cylindric', 'conoid', 'trilateral']) as Callout<Shape3D>).appendTo(slot)
					calloutSelector.state.useManual(selected => {
						const oldCalloutValue = [...truthsCallout.value[i]].sort().join('') as Callout3DOptional
						const newCalloutValue = !selected ? '  ' : reverse3DMap[selected]
						if (oldCalloutValue !== newCalloutValue) {
							truthsCallout.value = [...truthsCallout.value.slice(0, i), newCalloutValue, ...truthsCallout.value.slice(i + 1)] as [Callout3DOptional, Callout3DOptional, Callout3DOptional]
							typedTruthCallout.value = ''
						}
					})
					truthsCallout.use(calloutSelector, callout => calloutSelector.select(callout3DMap[callout[i] as Callout3D]))
				}
			}))
		)

	InputBus.event.subscribe('Down', (event, input) => {
		if (!truthsCard.hasFocused.value)
			return

		let modified = false
		let newCalloutValue = typedTruthCallout.value
		if (input.use('c') || input.use('C'))
			newCalloutValue += 'c'

		if (input.use('s') || input.use('S'))
			newCalloutValue += 's'

		if (input.use('t') || input.use('T'))
			newCalloutValue += 't'

		if (input.use('Backspace')) {
			modified = true

			const newCalloutTuple = [...truthsCallout.value]
			while (newCalloutTuple.at(-1) === '  ')
				newCalloutTuple.pop()
			newCalloutTuple.splice(-1, Infinity)
			while (newCalloutTuple.at(-1) === '  ')
				newCalloutTuple.pop()

			newCalloutValue = newCalloutTuple.join('')
		}

		newCalloutValue = newCalloutValue.slice(0, 6)
		if (typedTruthCallout.value !== newCalloutValue || modified) {
			typedTruthCallout.value = newCalloutValue
			truthsCallout.value = [
				typedTruthCallout.value.slice(0, 2).padEnd(2, ' ') as Callout3D || '  ',
				typedTruthCallout.value.slice(2, 4).padEnd(2, ' ') as Callout3D || '  ',
				typedTruthCallout.value.slice(4, 6).padEnd(2, ' ') as Callout3D || '  ',
			]
			if (truthsCallout.value.join('').replaceAll(' ', '').length === 6)
				nextCard()
		}
	})

	//#endregion
	////////////////////////////////////

	Component().style('app-break').appendTo(app)

	BaseCard()
		.style('app-card')
		.tweak(card => card.header.style('app-card-header'))
		.tweak(card => card.headerText.set(quilt => quilt['card/inside-goal/title']()))
		.tweak(card => card.descriptionText.set(quilt => quilt['card/inside-goal/description']()))
		.appendTo(app)

	type TruthsState = `${Callout3D}${Callout3D}${Callout3D}`
	interface Node {
		connections: Map<TruthsState, ConnectionSwap>
	}

	interface ConnectionSwap {
		components: Callout3D
		positions: Partial<Record<CalloutLetter, 0 | 1 | 2>>
	}
	const statuePositions = ['left', 'middle', 'right'] as const

	const graph = {} as Record<TruthsState, Node>

	////////////////////////////////////
	//#region Truths Graph

	const possibleTruths = Object.values(reverse3DMap)
	for (const truthLeft of possibleTruths) {
		for (const truthMid of possibleTruths) {
			NextPossibleTruth: for (const truthRight of possibleTruths) {
				const state: TruthsState = `${truthLeft}${truthMid}${truthRight}`
				for (const letter of Object.values(shadowLetterMap))
					if (state.replaceAll(letter, '').length < 4)
						// there must have been more than 2 occurrences, which is impossible
						continue NextPossibleTruth

				graph[state] ??= { connections: new Map() }
			}
		}
	}

	for (const state of Object.keys(graph) as TruthsState[]) {
		for (let i = 0; i < state.length; i++) {
			const selectLetter = state[i]
			const selectStatue = Math.floor(i / 2)

			for (let j = 0; j < state.length; j++) {
				const destLetter = state[j]
				const destStatue = Math.floor(j / 2)
				if (selectLetter === destLetter || selectStatue === destStatue)
					continue

				const stateSplit = state.split('')
				stateSplit[i] = destLetter
				stateSplit[j] = selectLetter
				let stateAfterSwap = stateSplit.join('')
				stateAfterSwap = `${[...stateAfterSwap.slice(0, 2)].sort().join('')}${[...stateAfterSwap.slice(2, 4)].sort().join('')}${[...stateAfterSwap.slice(4, 6)].sort().join('')}`
				const swap: ConnectionSwap = {
					components: [destLetter, selectLetter].sort().join('') as Callout3D,
					positions: { [selectLetter]: selectStatue, [destLetter]: destStatue },
				}
				graph[state].connections.set(stateAfterSwap as TruthsState, swap)
			}
		}
	}

	const remainders: Partial<Record<Callout3D, CalloutLetter>> = {
		st: 'c',
		ct: 's',
		cs: 't',
	}
	interface Path {
		path: TruthsState[]
		cost: number
	}
	function findPath (current: TruthsState, target: TruthsState, needsRemainder: CalloutLetter | null, pathCost = 0, seen: TruthsState[] = []): Path | null {
		if (current === target)
			return { path: [...seen.slice(1), current], cost: pathCost }

		if (pathCost > 6)
			return null

		const node = graph[current]
		if (!node)
			throw new Error('How did we get here?')

		seen.push(current)
		let bestOption: Path | null = null
		for (const [next, swap] of node.connections) {
			if (seen.includes(next))
				continue // this node has already been visited on this path

			let newNodeCost = 1
			if (needsRemainder && !swap.components.includes(needsRemainder))
				newNodeCost += 3

			const result = findPath(next, target, needsRemainder ? null : remainders[swap.components] || null, pathCost + newNodeCost, seen)
			if (!result)
				continue

			if (!bestOption || result.cost < bestOption.cost)
				bestOption = result
		}
		seen.pop()
		return bestOption
	}

	//#endregion
	////////////////////////////////////

	BaseCard()
		.style('app-card')
		.tweak(card => card.header.style('app-card-header'))
		.tweak(card => card.headerText.set(quilt => quilt['card/outside-goal/title']()))
		.tweak(card => card.descriptionText.set(quilt => quilt['card/outside-goal/description']()))
		.append(Slot().use(State.UseManual({ shadowCallout, truthsCallout, hasShadowDupe, hasTruthDupe }), (slot, { shadowCallout, truthsCallout, hasShadowDupe, hasTruthDupe }) => {
			if (hasShadowDupe || hasTruthDupe) {
				Component()
					.style('app-card-heading')
					.text.set(quilt => quilt['card/outside-goal/has-dupe/title']())
					.appendTo(slot)
				Paragraph().and(Lore)
					.text.set(quilt => quilt['card/outside-goal/has-dupe/description']())
					.appendTo(slot)
				return
			}

			if (shadowCallout.replaceAll(' ', '').length < 3 || truthsCallout.join('').replaceAll(' ', '').length < 6)
				return

			// calc time
			const targetMap: Record<CalloutLetter, Callout3D> = {
				c: 'st',
				s: 'ct',
				t: 'cs',
			}
			const target = [...shadowCallout].map(letter => targetMap[letter as CalloutLetter]).join('') as TruthsState
			const initial = truthsCallout.map(c => [...c].sort().join('')).join('') as TruthsState

			const path = findPath(initial, target, null)?.path
			if (!path)
				throw new Error('No path found????')

			console.log(path)

			const swaps: Record<CalloutLetter, number> = { c: 0, s: 0, t: 0 }
			const wrapper = Component().style('path').appendTo(slot)
			for (let i = 0; i < path.length; i++) {
				const lastNode = graph[path[i - 1] || initial]
				if (!lastNode)
					throw new Error('Last node is not in the graph??????')

				const currentNode = path[i]
				const swap = lastNode.connections.get(currentNode)
				if (!swap)
					throw new Error('No connection between these two nodes?????????')

				const swapUI = Component()
					.style('path-swap')
					.append(Component()
						.style('path-swap-number')
						.text.set(`${i + 1}`)
					)
					.appendTo(wrapper)

				const swapInstructions = Component()
					.style('path-swap-instructions')
					.appendTo(swapUI)

				const swapComponents = swap.components.split('') as CalloutLetter[]
				// ensure that when swap components are broken up between two rounds, the last round one goes first
				swapComponents.sort((a, b) => swaps[a] - swaps[b])

				for (let j = 0; j < swapComponents.length; j++) {
					const hadSwapsOfThisType = swaps[swapComponents[j]]++
					if (hadSwapsOfThisType) {
						Component()
							.style('path-swap-instructions-step', 'path-swap-instructions-step--side')
							.text.set(quilt => quilt['card/outside-goal/path/ogres']())
							.appendTo(swapInstructions)
						swaps.c = 0
						swaps.s = 0
						swaps.t = 0
					}

					const stepGroup = Component()
						.style('path-swap-instructions-step-group')
						.appendTo(swapInstructions)

					const swapLetter = swapComponents[j]
					const shape = shadowCalloutMap[swapLetter]
					Component()
						.style('path-swap-instructions-step')
						.text.set(quilt => quilt[`card/outside-goal/path/${shape}`]())
						.appendTo(stepGroup)

					const position = swap.positions[swapLetter]
					const positionString = statuePositions[position!]
					if (!positionString)
						throw new Error('No position for swap component?????')

					if (j === 0) {
						// dissect select
						Component()
							.style('path-swap-instructions-step')
							.text.set(quilt => quilt['card/outside-goal/path/dissect-select'](quilt[`card/outside-goal/path/${positionString}`]()))
							.appendTo(stepGroup)
						continue
					}

					const newShape = callout3DMap[currentNode.slice(position! * 2, position! * 2 + 2) as Callout3D]

					// dissect complete
					Component()
						.style('path-swap-instructions-step')
						.text.set(quilt => quilt['card/outside-goal/path/dissect-complete'](
							quilt[`card/outside-goal/path/${positionString}`](),
						))
						.appendTo(stepGroup)
					Component()
						.style('path-swap-instructions-step')
						.text.set(quilt => quilt['card/outside-goal/path/dissect-result'](
							quilt[`shape/${newShape}`](),
						))
						.appendTo(stepGroup)
				}
			}
		}))
		.appendTo(app)

	return component
})

// function occurrences (string: string, substring: string): number {
// 	let occurrenceIndex = string.indexOf(substring)
// 	if (occurrenceIndex === -1)
// 		return 0

// 	let count = 0
// 	while (occurrenceIndex !== -1) {
// 		count++
// 		occurrenceIndex = string.indexOf(substring, occurrenceIndex + 1)
// 	}
// 	return count
// }
