import Image from 'component/core/Image'
import { Component } from 'kitsui'

enum EIcon {
	orbicular,
	quadrate,
	trigon,

	cuboid,
	spheric,
	pyramidic,
	conoid,
	cylindric,
	trilateral,

	left,
	middle,
	right,
}

type Icon = keyof typeof EIcon

const Icon = Object.assign(
	Component((component, icon: Icon): Component<HTMLImageElement> => {
		return component.and(Image, `/static/image/${icon}.png`)
			.style('icon')
	}),
	{
		is (icon: unknown): icon is Icon {
			return typeof icon === 'string' && icon in EIcon
		},
	}
)

export default Icon
