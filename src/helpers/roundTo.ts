export function round(value: number, step = 1): number {
	step || (step = 1.0);
	const inv = 1.0 / step;
	return Math.round(value * inv) / inv;
}
