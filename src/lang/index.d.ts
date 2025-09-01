export interface Weave {
	content: Weft[]
	toString(): string
}

export interface Weft {
	content: WeavingArg | Weft[]
	tag?: string
}

declare const SYMBOL_WEAVING_RENDERABLE: unique symbol
declare const SYMBOL_WEAVING_RENDERABLE_TO_STRING: unique symbol

export interface WeavingRenderable {
	[SYMBOL_WEAVING_RENDERABLE]: true
	[SYMBOL_WEAVING_RENDERABLE_TO_STRING]?(): string
}
	
export type WeavingArg = Weave | WeavingRenderable | string | number | undefined | null
export namespace WeavingArg {
	export function setRenderable<T>(value: T, toString?: () => string): T & WeavingRenderable
	export function isRenderable<T>(value: T): value is T & WeavingRenderable
}

export interface Quilt {
	"shared/errored"(): Weave
	"shared/load/connecting"(): Weave
	"title"(): Weave
	"subtitle"(): Weave
	"shape/orbicular"(): Weave
	"shape/quadrate"(): Weave
	"shape/trigon"(): Weave
	"shape/cuboid"(): Weave
	"shape/spheric"(): Weave
	"shape/pyramidic"(): Weave
	"shape/conoid"(): Weave
	"shape/cylindric"(): Weave
	"shape/trilateral"(): Weave
	"card/callout/title"(): Weave
	"card/callout/description"(arg_0: WeavingArg): Weave
	"card/truth/title"(): Weave
	"card/truth/description"(): Weave
	"card/inside-goal/title"(): Weave
	"card/inside-goal/description"(): Weave
	"card/outside-goal/title"(): Weave
	"card/outside-goal/description"(): Weave
	"card/outside-goal/has-dupe/title"(): Weave
	"card/outside-goal/has-dupe/description"(): Weave
	"card/outside-goal/path/orbicular"(): Weave
	"card/outside-goal/path/trigon"(): Weave
	"card/outside-goal/path/quadrate"(): Weave
	"card/outside-goal/path/dissect-select"(arg_0: WeavingArg): Weave
	"card/outside-goal/path/dissect-complete"(arg_0: WeavingArg): Weave
	"card/outside-goal/path/dissect-result"(arg_0: WeavingArg): Weave
	"card/outside-goal/path/ogres"(): Weave
	"card/outside-goal/path/left"(): Weave
	"card/outside-goal/path/middle"(): Weave
	"card/outside-goal/path/right"(): Weave
}

declare const quilt: Quilt

export namespace Quilt {
	export type Key = keyof Quilt
	export type SimpleKey = keyof { [KEY in keyof Quilt as Parameters<Quilt[KEY]> extends [infer First, ...infer Rest] ? never : KEY]: true }
	export type Handler<ARGS extends any[] = []> = (quilt: Quilt, ...args: ARGS) => Weave
}

export default quilt
