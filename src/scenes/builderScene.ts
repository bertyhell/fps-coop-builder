import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

// If you don't need the standard material you will still need to import it since the scene requires it.
// import "@babylonjs/core/Materials/standardMaterial";
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import {
	Camera,
	Color3,
	CreateSphere,
	CubeTexture,
	HemisphericLight,
	MeshBuilder,
	TransformNode,
	UniversalCamera,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Button, Image } from '@babylonjs/gui';
import { KEYCODE } from '../keycodes';

import circleImage from '../../assets/circle.svg';
import groundImage from '../../assets/ground.png';

const MOUSE_SENSITIVITY = 0.0002;
const MAP_SIZE = 80;

export class BuilderScene {
	private readonly _scene: Scene;
	private readonly _player: TransformNode;
	private readonly _activeCamera: Camera;
	private readonly _cameraNode: TransformNode;
	private _keys = { left: false, right: false, forward: false, back: false };

	get activeCamera(): Camera {
		return this._activeCamera;
	}

	constructor(private _engine: Engine, private _canvas: HTMLCanvasElement) {
		this._engine.enableOfflineSupport = false;
		// This creates a basic Babylon Scene object (non-mesh)
		this._scene = new Scene(this._engine);
		this._scene.useRightHandedSystem = true;
		this._scene.gravity = new Vector3(0, -0.15, 0);
		BuilderScene.setupSun(this._scene);

		// void Promise.all([
		//     import("@babylonjs/core/Debug/debugLayer"),
		//     import("@babylonjs/inspector")
		// ]).then((_values) => {
		//     console.log(_values);
		//     this.scene.debugLayer.show({
		//         handleResize: true,
		//         overlay: true,
		//         globalRoot: document.getElementById("#root") || undefined
		//     });
		// });

		BuilderScene.setupSkybox(this._scene);
		BuilderScene.setupGroundPlane(this._scene);

		BuilderScene.setupCrosshair();

		// This creates and positions a free camera (non-mesh)
		const [player, camera, cameraNode] = this.setupPlayerAndCamera(this._scene, _canvas);
		this._player = player;
		this._activeCamera = camera;
		this._cameraNode = cameraNode;
		this.setupPointerLock(_canvas, _engine, this._player);

		// // Our built-in 'sphere' shape.
		const sphere = CreateSphere('sphere', { diameter: 2, segments: 32 }, this._scene);

		// Move the sphere upward 1/2 its height
		sphere.position.y = 1;
		sphere.position.x = -2;

		// const shadowGenerator = new ShadowGenerator(512, light)
		// shadowGenerator.useBlurExponentialShadowMap = true;
		// shadowGenerator.blurScale = 2;
		// shadowGenerator.setDarkness(0.2);
		//
		// shadowGenerator.getShadowMap()!.renderList!.push(sphere);

		// // Debug layer
		// this.scene.debugLayer.show({
		//     embedMode: true
		// });
	}

	private static mouseMove(e: MouseEvent, engine: Engine, player: TransformNode) {
		const deltaTime = engine.getDeltaTime();

		const movementX = e.movementX || 0;

		const movementY = e.movementY || 0;

		player.rotation.x += movementY * deltaTime * MOUSE_SENSITIVITY;
		player.rotation.y -= movementX * deltaTime * MOUSE_SENSITIVITY;
	}

	private changeCallback(canvas: HTMLCanvasElement, engine: Engine, player: TransformNode) {
		const mouseMove = (evt: MouseEvent) => {
			BuilderScene.mouseMove(evt, engine, player);
		};
		if (document.pointerLockElement === canvas) {
			// we've got a pointerlock for our element, add a mouselistener
			document.addEventListener('mousemove', mouseMove, false);
			document.addEventListener('mousedown', mouseMove, false);
			document.addEventListener('mouseup', mouseMove, false);
		} else {
			// pointer lock is no longer active, remove the callback
			document.removeEventListener('mousemove', mouseMove, false);
			document.removeEventListener('mousedown', mouseMove, false);
			document.removeEventListener('mouseup', mouseMove, false);
		}
	}

	private setupPointerLock(canvas: HTMLCanvasElement, engine: Engine, player: TransformNode) {
		const onPointerLockChange = () => this.changeCallback(canvas, engine, player);

		// register the callback when a pointerlock event occurs
		document.addEventListener('pointerlockchange', onPointerLockChange, false);

		// when element is clicked, we're going to request a pointerlock
		canvas.onclick = function () {
			// Ask the browser to lock the pointer
			canvas.requestPointerLock();
		};
	}

	private static setupSkybox(scene: Scene) {
		// Skybox material
		const skyboxMaterial = new StandardMaterial('skyBox', scene);
		skyboxMaterial.backFaceCulling = false;
		skyboxMaterial.reflectionTexture = new CubeTexture('textures/skybox', scene);
		skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
		skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
		skyboxMaterial.specularColor = new Color3(0, 0, 0);

		// Skybox
		const skybox = MeshBuilder.CreateBox('skyBox', { size: 1000.0 }, scene);
		skybox.material = skyboxMaterial;
	}

	private static setupGroundPlane(scene: Scene) {
		const mat1 = new StandardMaterial('mat0', scene);
		const texture = new Texture(groundImage, scene);
		texture.uScale = MAP_SIZE;
		texture.vScale = MAP_SIZE;
		mat1.diffuseTexture = texture;
		mat1.specularColor = Color3.Black();
		mat1.emissiveColor = Color3.White();
		const ground = MeshBuilder.CreateGround(
			'ground',
			{ height: MAP_SIZE, width: MAP_SIZE, subdivisions: 4 },
			scene
		);
		ground.material = mat1;
	}

	private static setupCrosshair() {
		const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('Ui');
		const crosshair = Button.CreateImageOnlyButton('b1', circleImage);
		if (crosshair.image) {
			crosshair.image.stretch = Image.STRETCH_UNIFORM;
		}
		crosshair.width = '24px';
		crosshair.height = '24px';
		crosshair.color = 'transparent';
		advancedTexture.addControl(crosshair);
	}

	private handleKeyUp(evt: KeyboardEvent) {
		if (evt.keyCode == KEYCODE.KEY_Q) {
			this._keys.left = false;
		}
		if (evt.keyCode == KEYCODE.KEY_D) {
			this._keys.right = false;
		}
		if (evt.keyCode == KEYCODE.KEY_Z) {
			this._keys.forward = false;
		}
		if (evt.keyCode == KEYCODE.KEY_S) {
			this._keys.back = false;
		}
	}

	private handleKeyDown(evt: KeyboardEvent) {
		if (evt.keyCode == KEYCODE.KEY_Q) {
			this._keys.left = true;
		}
		if (evt.keyCode == KEYCODE.KEY_D) {
			this._keys.right = true;
		}
		if (evt.keyCode == KEYCODE.KEY_Z) {
			this._keys.forward = true;
		}
		if (evt.keyCode == KEYCODE.KEY_S) {
			this._keys.back = true;
		}
	}

	private setupPlayerAndCamera(
		scene: Scene,
		canvas: HTMLCanvasElement
	): [TransformNode, Camera, TransformNode] {
		const tempCamera = new UniversalCamera('FPS', new Vector3(0, 0, 0), scene);
		tempCamera.attachControl(canvas, true);
		scene.activeCameras?.push(tempCamera);

		const tempPlayer = new TransformNode('player', scene);
		const tempCameraNode = new TransformNode('camera', scene);

		tempCamera.minZ = 0.0001;
		tempPlayer.parent = tempCamera;
		tempCamera.parent = tempCameraNode;
		tempCamera.position.y = 1;

		// Event listener for mouse keys
		canvas.addEventListener('pointerup', () => {
			// ignore up events
		});
		canvas.addEventListener('pointerdown', function () {
			console.log('click');
		});

		// Event listener for WASD movement keys
		window.addEventListener('keydown', (evt: KeyboardEvent) => this.handleKeyDown(evt), false);
		window.addEventListener('keyup', (evt: KeyboardEvent) => this.handleKeyUp(evt), false);

		return [tempPlayer, tempCamera, tempCameraNode];
	}

	private update() {
		const cameraDirection = this._activeCamera
			.getForwardRay()
			.direction.normalizeFromLength(10);
		const cameraDirectionPlane = new Vector3(cameraDirection.x, 0, cameraDirection.z);
		if (this._keys.left) {
			this._cameraNode.position.addInPlace(
				cameraDirectionPlane.applyRotationQuaternion(
					Quaternion.FromEulerAngles(0, Math.PI / 2, 0)
				)
			);
		}
		if (this._keys.right) {
			this._cameraNode.position.addInPlace(
				cameraDirectionPlane.applyRotationQuaternion(
					Quaternion.FromEulerAngles(0, -Math.PI / 2, 0)
				)
			);
		}
		if (this._keys.forward) {
			this._cameraNode.position.addInPlace(cameraDirectionPlane);
		}
		if (this._keys.back) {
			this._cameraNode.position.addInPlace(cameraDirectionPlane.negate());
		}
	}

	render() {
		this.update();
		this._scene.render();
	}

	private static setupSun(scene: Scene) {
		// This creates a light, aiming 0,1,0 - to the sky (non-mesh)
		const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);

		// Default intensity is 1. Let's dim the light a small amount
		light.intensity = 0.7;
	}
}
