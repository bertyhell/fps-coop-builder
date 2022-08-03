import { Engine } from '@babylonjs/core/Engines/engine';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.uniformBuffer';
import { BuilderScene } from './scenes/builderScene';

import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';

export const babylonInit = async (): Promise<void> => {
	const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

	const engine: Engine = new Engine(canvas, true, {
		preserveDrawingBuffer: true,
		stencil: true,
		disableWebGL2Support: false,
	});

	engine.displayLoadingUI();

	// Create the scene
	const builderScene = new BuilderScene(engine, canvas);

	// Register a render loop to repeatedly render the scene
	engine.runRenderLoop(function () {
		if (builderScene && builderScene.activeCamera) {
			builderScene.render();
		}
	});

	// Watch for browser/canvas resize events
	window.addEventListener('resize', function () {
		engine.resize();
	});

	engine.hideLoadingUI();
};

babylonInit().then(() => {
	// scene started rendering, everything is initialized
});
