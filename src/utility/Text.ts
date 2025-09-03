import Icon from 'component/core/Icon'
import { Component, State } from 'kitsui'
import { StringApplicatorSource } from 'kitsui/utility/StringApplicator'
import type { Quilt, Weave, Weft } from 'lang'
import quiltBase, { WeavingArg } from 'lang'

declare module 'kitsui/utility/StringApplicator' {
	interface StringApplicatorSources {
		weave: Quilt.Handler
	}
}

export const quilt: State<Quilt> = State(quiltBase)

namespace Text {
	export function init () {
		StringApplicatorSource.register('weave', {
			match (source): source is Quilt.Handler {
				return typeof source === 'function'
			},
			toNodes (source: Quilt.Handler): Node[] {
				return renderWeave(source(quilt.value))
			},
			toString (source: Quilt.Handler): string {
				return source(quilt.value).toString()
			},
		})
	}

	export function isWeave (weave: Weave | Weft): weave is Weave {
		return Object.keys(weave).includes('toString')
	}

	export function renderWeave (weave: Weave): Node[] {
		return weave.content.map(renderWeft)
	}

	export function toString (weave: Weave | Weft | WeavingArg): string {
		return quilt.value['shared/passthrough'](weave).toString()
	}

	const voidElements = new Set([
		'AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT',
		'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR',
	])
	function renderWeft (weft: Weft): Node {
		if (isPlaintextWeft(weft))
			return document.createTextNode(weft.content)

		let element = !weft.tag ? undefined : createTagElement(weft.tag, weft)
		element ??= document.createElement('span')

		if (voidElements.has(element.tagName)) {
			// :3
		}
		else if (Array.isArray(weft.content))
			element.append(...weft.content.map(renderWeft))
		else if (typeof weft.content === 'object' && weft.content) {
			if (!WeavingArg.isRenderable(weft.content)) {
				if (isWeave(weft.content))
					element.append(...renderWeave(weft.content))
				else
					element.append(renderWeft(weft.content))
			}
			else if (Component.is(weft.content))
				element.append(weft.content.element)
			else if (weft.content instanceof Node)
				element.append(weft.content)
			else
				console.warn('Unrenderable weave content:', weft.content)
		}
		else {
			const value = `${weft.content ?? ''}`
			const texts = value.split('\n')
			for (let i = 0; i < texts.length; i++) {
				if (i > 0)
					element.append(Component('br').element, Component().style('break').element)

				element.append(document.createTextNode(texts[i]))
			}
		}

		return element
	}

	function isPlaintextWeft (weft: Weft): weft is Weft & { content: string } {
		return true
			&& typeof weft.content === 'string'
			&& !weft.content.includes('\n')
			&& !weft.tag
	}

	export function createTagElement (tag: string, weft?: Weft): HTMLElement | undefined {
		const unlowercased = tag
		tag = tag.toLowerCase()

		if (tag === 'hidden')
			return Component()
				.style('hidden')
				.ariaHidden()
				.attributes.append('inert')
				.element

		if (tag.startsWith('link(')) {
			let href = unlowercased.slice(5, -1)
			// const link = href.startsWith('/')
			// 	? Link(href as RoutePath)
			// 	: ExternalLink(href)

			if (!href.startsWith('/') && !href.startsWith('.'))
				href = `https://${href}`

			return Component('a')
				.style('link')
				.attributes.set('href', href)
				.element
		}

		// if (tag.startsWith('.')) {
		// 	const className = tag.slice(1)
		// 	if (className in style.value)
		// 		return Component()
		// 			.style(className as keyof typeof style.value)
		// 			.element
		// }

		if (tag === 'icon') {
			const iconName = toString(weft)
			if (!Icon.is(iconName)) {
				console.warn('Unregistered icon', iconName)
				return undefined
			}

			return Icon(iconName).element
		}

		switch (tag) {
			case 'b': return document.createElement('strong')
			case 'i': return document.createElement('em')
			case 'u': return document.createElement('u')
			case 's': return document.createElement('s')
			case 'code': return Component('code').style('code').element

			// case 'sm': return Component('small')
			// 	.style('small')
			// 	.element
		}
	}
}

export default Text
