import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

// If you don't need the standard material you will still need to import it since the scene requires it.
// import "@babylonjs/core/Materials/standardMaterial";
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import {
	AbstractMesh,
	Camera,
	Color3,
	CreateBox,
	CreateSphere,
	CubeTexture,
	HemisphericLight,
	Mesh,
	MeshBuilder,
	Nullable,
	UniversalCamera,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Button, Image } from '@babylonjs/gui';
import { KEYCODE } from '../keycodes';
import circleImage from '../../public/textures/circle.svg';
import groundImage from '../../public/textures/ground.png';
import cementImage from '../../public/textures/cement.jpg';
import { GroundMesh } from '@babylonjs/core/Meshes/groundMesh';
import { round } from '../helpers/roundTo';

const MAP_SIZE = 80;
const GRID = 0.5;

const BLOCK_HEIGHT = 1;

export class BuilderScene {
	private readonly _scene: Scene;
	private readonly _ground: GroundMesh;
	private readonly _activeCamera: Camera;
	private _keys = { left: false, right: false, forward: false, back: false };
	private _meshes: Mesh[] = []; // TODO make more efficient storage structure based on 2d grid of coordinates
	private _lookAtPoint: Nullable<Vector3> = null;
	private _pickedMesh: Nullable<AbstractMesh> = null;
	private readonly _cementMaterial: StandardMaterial;
	private _cementBlock: Mesh;
	private _ghostBlock: Mesh;
	private _placementAngle: number;

	get activeCamera(): Camera {
		return this._activeCamera;
	}

	constructor(private _engine: Engine, private _canvas: HTMLCanvasElement) {
		this._engine.enableOfflineSupport = false;
		// This creates a basic Babylon Scene object (non-mesh)
		this._scene = new Scene(this._engine);
		this._scene.useRightHandedSystem = true;
		this._scene.collisionsEnabled = true;
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
		this._ground = BuilderScene.setupGroundPlane(this._scene);
		this._meshes.push(this._ground);

		BuilderScene.setupCrosshair();

		// This creates and positions a free camera (non-mesh)
		const camera = this.setupPlayerAndCamera(this._scene, _canvas);
		this._activeCamera = camera;
		this.setupPointerLock(_canvas);

		// // Our built-in 'sphere' shape.
		const sphere = CreateSphere('sphere', { diameter: 4, segments: 32 }, this._scene);

		// Move the sphere upward 1/2 its height
		sphere.position.y = 2;
		sphere.position.x = 10;
		sphere.position.z = 10;

		this._meshes.push(sphere);

		// Cement texture for blocks
		this._cementMaterial = new StandardMaterial('cementMat', this._scene);
		const texture = new Texture(cementImage, this._scene);
		texture.uScale = 0.5;
		texture.vScale = 1;
		this._cementMaterial.diffuseTexture = texture;
		this._cementMaterial.specularColor = Color3.Black();
		this._cementMaterial.emissiveColor = Color3.White();
		const boxSize = {
			width: 1,
			height: BLOCK_HEIGHT,
			depth: 2,
		};
		this._cementBlock = CreateBox(
			'box_' + Math.random().toString().substring(2, 9),
			{ ...boxSize },
			this._scene
		);
		this._cementBlock.material = this._cementMaterial;
		this._cementBlock.checkCollisions = true;

		this._ghostBlock = this._cementBlock.clone('ghostBlock');
		const ghostCementMaterial = this._cementBlock.material.clone(
			'ghostCementMat'
		) as StandardMaterial;
		ghostCementMaterial.alpha = 0.4;
		this._ghostBlock.material = ghostCementMaterial;

		this._placementAngle = 0;

		// load 3d model
		// const model =
		// var base64_model_content = "data:;base64,";
		// BABYLON.SceneLoader.Append("", base64_model_content, scene, function (scene) {
		//     // do something with the scene
		// });

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

	private setupPointerLock(canvas: HTMLCanvasElement) {
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

	private static setupGroundPlane(scene: Scene): GroundMesh {
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
		ground.checkCollisions = true;

		return ground;
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

		// rotate placement block
		if (evt.keyCode == KEYCODE.KEY_A) {
			this.rotateBlockLeft();
		}
		if (evt.keyCode == KEYCODE.KEY_E) {
			this.rotateBlockRight();
		}
	}

	private rotateBlockLeft() {
		this.rotateBlock(45);
	}

	private rotateBlockRight() {
		this.rotateBlock(-45);
	}

	private rotateBlock(angle: number) {
		this._placementAngle += (angle / 180) * Math.PI;
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

	private onLeftMouseClick() {
		if (this._lookAtPoint) {
			const newBlock = this._cementBlock.clone(
				'box_' + Math.random().toString().substring(2, 9)
			);
			newBlock.position = new Vector3(
				round(this._lookAtPoint.x, GRID),
				round(this._lookAtPoint.y, GRID) + BLOCK_HEIGHT / 2,
				round(this._lookAtPoint.z, GRID)
			);
			newBlock.rotation = new Vector3(0, this._placementAngle, 0);
			newBlock.checkCollisions = true;
			this._meshes.push(newBlock);
		}
	}

	private deletePointedAtMesh() {
		if (this._pickedMesh && this._pickedMesh.id !== this._ground.id) {
			const meshIndex = this._meshes.findIndex((mesh) => mesh.id === this._pickedMesh?.id);
			const meshToDelete = this._meshes[meshIndex];
			this._meshes.splice(meshIndex, 1);
			meshToDelete.dispose();
		}
	}

	private onMiddleMouseClick() {
		this.deletePointedAtMesh();
	}

	private setupPlayerAndCamera(scene: Scene, canvas: HTMLCanvasElement): UniversalCamera {
		const tempCamera = new UniversalCamera('FPS', new Vector3(0, 4, 0), scene);
		tempCamera.keysUp = [KEYCODE.KEY_Z, KEYCODE.KEY_W, KEYCODE.UP];
		tempCamera.keysDown = [KEYCODE.KEY_S, KEYCODE.DOWN];
		tempCamera.keysLeft = [KEYCODE.KEY_Q, KEYCODE.LEFT];
		tempCamera.keysRight = [KEYCODE.KEY_D, KEYCODE.RIGHT];
		tempCamera.attachControl(canvas, true);
		tempCamera.checkCollisions = true;
		tempCamera.ellipsoid = new Vector3(1, 1.8, 1);
		tempCamera.ellipsoidOffset = new Vector3(0, -0.2, 0);
		scene.activeCameras?.push(tempCamera);

		tempCamera.minZ = 0.0001;
		scene.gravity = new Vector3(0, -9.81, 0);
		tempCamera.applyGravity = true;

		// Event listener for mouse keys
		canvas.addEventListener('pointerup', () => {
			// ignore up events
		});
		canvas.addEventListener('pointerdown', (evt) => {
			console.log('click');

			if (evt.button === 0) {
				this.onLeftMouseClick();
			} else if (evt.button === 1) {
				this.onMiddleMouseClick();
			}
		});

		// Event listener for WASD movement keys
		window.addEventListener('keydown', (evt: KeyboardEvent) => this.handleKeyDown(evt), false);
		window.addEventListener('keyup', (evt: KeyboardEvent) => this.handleKeyUp(evt), false);
		window.addEventListener(
			'wheel',
			(evt: WheelEvent) => {
				this.rotateBlock(evt.deltaY > 0 ? 45 : -45);
			},
			false
		);

		return tempCamera;
	}

	private updateLookAtPoint() {
		const pickingRay = this._activeCamera.getForwardRay(
			undefined,
			undefined,
			this._activeCamera.position
		);

		const intersections = pickingRay.intersectsMeshes(this._meshes);

		if (!intersections?.length) {
			this._lookAtPoint = null;
			this._ghostBlock.position = new Vector3(0, -1, 0);
			return;
		}
		if (intersections[0].hit && intersections[0].pickedPoint) {
			this._pickedMesh = intersections[0].pickedMesh;
			this._lookAtPoint = intersections[0].pickedPoint;
			this._ghostBlock.position = new Vector3(
				round(this._lookAtPoint.x, GRID),
				round(this._lookAtPoint.y, GRID) + BLOCK_HEIGHT / 2,
				round(this._lookAtPoint.z, GRID)
			);
			this._ghostBlock.rotation = new Vector3(0, this._placementAngle, 0);
		}
	}

	private update() {
		this.updateLookAtPoint();
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
