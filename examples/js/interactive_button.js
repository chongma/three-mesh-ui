
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { BoxLineGeometry } from 'three/examples/jsm/geometries/BoxLineGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import ThreeMeshUI from '../../src/three-mesh-ui.js';
import VRControl from './utils/VRControl.js';
import ShadowedLight from './utils/ShadowedLight.js';

let scene, camera, renderer, controls, control;
let meshContainer, meshes, currentMesh;
let objsToTest = [];

window.addEventListener( 'load', init );
window.addEventListener('resize', onWindowResize );

// calculate mouse position in normalized device coordinates
// (-1 to +1) for both components.
// Used to raycasting against the interactive elements

const raycaster = new THREE.Raycaster();

const mouse = new THREE.Vector2();
mouse.x = mouse.y = null;

let selectState = false;

window.addEventListener( 'mousemove', ( event )=>{
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
});

window.addEventListener( 'mousedown', ()=> { selectState = true });

window.addEventListener( 'mouseup', ()=> { selectState = false });

window.addEventListener( 'touchstart', ( event )=> {
	selectState = true;
	mouse.x = ( event.touches[0].clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.touches[0].clientY / window.innerHeight ) * 2 + 1;
});

window.addEventListener( 'touchend', ()=> {
	selectState = false;
	mouse.x = null;
	mouse.y = null;
});

//

function init() {

	////////////////////////
	//  Basic Three Setup
	////////////////////////

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x505050 );

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.outputEncoding = THREE.sRGBEncoding;
	renderer.xr.enabled = true;
	document.body.appendChild( VRButton.createButton(renderer) );
	document.body.appendChild( renderer.domElement );
	renderer.shadowMap.enabled = true ;

	// Orbit controls for no-vr

	controls = new OrbitControls( camera, renderer.domElement );
	camera.position.set( 0, 1.6, 0 );
	controls.target = new THREE.Vector3( 0, 1, -1.8 );

	/////////
	// Room
	/////////

	const room = new THREE.LineSegments(
        new BoxLineGeometry( 6, 6, 6, 10, 10, 10 ).translate( 0, 3, 0 ),
		new THREE.LineBasicMaterial( { color: 0x808080 } )
	);
	
	const roomMesh = new THREE.Mesh(
		new THREE.BoxGeometry( 6, 6, 6, 10, 10, 10 ).translate( 0, 3, 0 ),
		new THREE.MeshBasicMaterial({ side: THREE.BackSide }),
	);

	scene.add( room );
    objsToTest.push(roomMesh);

	//////////
	// Light
	//////////

	const light = ShadowedLight({
		z: 10,
		width: 6,
		bias: -0.0001
	});

	const hemLight = new THREE.HemisphereLight( 0x808080, 0x606060 );

	scene.add( light, hemLight );

	////////////////
	// Controllers
	////////////////

	control = VRControl( renderer, camera, scene );

	scene.add( ...control.controllerGrips );

	control.controllers.forEach( (controller)=> {

		scene.add( controller );

		controller.addEventListener( 'selectstart', ()=> { selectState = true } );
		controller.addEventListener( 'selectend', ()=> { selectState = false } );

	});

	////////////////////
	// Primitive Meshes
	////////////////////

	meshContainer = new THREE.Group();
	meshContainer.position.set( 0, 1, -1.9 );
	scene.add( meshContainer );

	//

	const sphere = new THREE.Mesh(
		new THREE.IcosahedronBufferGeometry( 0.3, 1 ),
		new THREE.MeshStandardMaterial({ color: 0x3de364, flatShading: true })
	);
	
	const box = new THREE.Mesh(
		new THREE.BoxBufferGeometry( 0.45, 0.45, 0.45 ),
		new THREE.MeshStandardMaterial({ color: 0x643de3, flatShading: true })
	);
	
	const cone = new THREE.Mesh(
		new THREE.ConeBufferGeometry( 0.28, 0.5, 10 ),
		new THREE.MeshStandardMaterial({ color: 0xe33d4e, flatShading: true })
	);

	//

	sphere.visible = box.visible = cone.visible = false;

	meshContainer.add( sphere, box, cone );

	meshes = [ sphere, box, cone ];
	currentMesh = 0;

	showMesh( currentMesh );
 	
 	//////////
	// Panel
	//////////

	makePanel();

	//

	renderer.setAnimationLoop( loop );

};

// Shows the primitive mesh with the passed ID and hide the others

function showMesh( id ) {

	meshes.forEach( (mesh, i)=> {
		mesh.visible = i === id ? true : false;
	});

};

///////////////////
// UI contruction
///////////////////

function makePanel() {

	// Materials used by the buttons on idle and hover

	const opaqueMaterial = new THREE.MeshLambertMaterial({
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.5
	});

	const clearMaterial = new THREE.MeshLambertMaterial({
		side: THREE.DoubleSide
	});

	// Container block, in which we put the two buttons.
	// We don't define width and height, it will be set automatically from the children's dimensions
	// Note that we set contentDirection: "row-reverse", in order to orient the buttons horizontally

	const container = ThreeMeshUI.Block({
		justifyContent: 'center',
		alignContent: 'center',
		contentDirection: 'row-reverse',
		fontFamily: './assets/helvetiker_regular.typeface.json',
		textType: 'geometry',
		backgroundMaterial: opaqueMaterial
	});

	container.position.set( 0, 0.6, -1.2 );
	container.rotation.x = -0.55;
	scene.add( container );

	// BUTTONS

	// We start by creating objects containing options that we will use with the two buttons,
	// in order to write less code.

	const buttonOptions = {
		width: 0.5,
		height: 0.2,
		justifyContent: 'center',
		alignContent: 'center',
		offset: 0.05,
		margin: 0.05
	};

	// Options for component.setupState().
	// It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

	const hoveredStateOptions = {
		state: "hovered",
		attributes: {
			offset: 0.05,
			backgroundMaterial: clearMaterial
		},
		onSet: ()=> { /* console.log('I get called when button is set hovered') */ }
	};

	const idleStateOptions = {
		state: "idle",
		attributes: {
			offset: 0.05,
			backgroundMaterial: opaqueMaterial
		},
		onSet: ()=> { /* console.log('I get called when button is set idle') */ }
	};

	// Buttons creation, with the options objects passed in parameters.

	const buttonNext = ThreeMeshUI.Block( buttonOptions );
	const buttonPrevious = ThreeMeshUI.Block( buttonOptions );

	// Add text to buttons

	buttonNext.add(
		ThreeMeshUI.Text({
			content: "next",
		})
	);

	buttonPrevious.add(
		ThreeMeshUI.Text({
			content: "previous"
		})
	);

	// Create states for the buttons.
	// In the loop, we will call component.setState( 'state-name' ) when mouse hover or click

	buttonNext.setupState({
		state: "selected",
		attributes: {
			offset: 0.02,
			backgroundMaterial: clearMaterial
		},
		onSet: ()=> {
			currentMesh = (currentMesh + 1) % 3 ;
			showMesh( currentMesh );
		}
	});
	buttonNext.setupState( hoveredStateOptions );
	buttonNext.setupState( idleStateOptions );

	buttonPrevious.setupState({
		state: "selected",
		attributes: {
			offset: 0.02,
			backgroundMaterial: clearMaterial
		},
		onSet: ()=> {
			currentMesh -= 1;
			if ( currentMesh < 0 ) currentMesh = 2;
			showMesh( currentMesh );
		}
	});
	buttonPrevious.setupState( hoveredStateOptions );
	buttonPrevious.setupState( idleStateOptions );

	container.add( buttonNext, buttonPrevious );
	objsToTest.push( buttonNext, buttonPrevious );

};

// Handle resizing the viewport

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

};

//

function loop() {

	controls.update();

	meshContainer.rotation.z += 0.01;
	meshContainer.rotation.y += 0.01;

	renderer.render( scene, camera );

	updateButtons();

};

// Called in the loop, get intersection with either the mouse or the VR controllers,
// then update the buttons states according to result

function updateButtons() {

	// Find closest intersecting object

	let intersect;

	if ( renderer.xr.isPresenting ) {

		control.setFromController( 0, raycaster.ray );

		intersect = raycast();

		// Position the little white dot at the end of the controller pointing ray
		control.setPointerAt( 0, intersect.point );

	} else if ( mouse.x !== null && mouse.y !== null ) {

		raycaster.setFromCamera( mouse, camera );

		intersect = raycast();

	};

	// Update targeted button state (if any)

	if ( intersect && intersect.object.isUI ) {

		if ( selectState ) {

			// Component.setState internally call component.set with the options you defined in component.setupState
			intersect.object.setState( 'selected' );

		} else {

			// Component.setState internally call component.set with the options you defined in component.setupState
			intersect.object.setState( 'hovered' );

		};

	};

	// Update non-targeted buttons state

	objsToTest.forEach( (obj)=> {

		if ( (!intersect || obj !== intersect.object) && obj.isUI ) {

			// Component.setState internally call component.set with the options you defined in component.setupState
			obj.setState( 'idle' );

		};

	});

};

//

function raycast() {

	return objsToTest.reduce( (closestIntersection, obj)=> {

		const intersection = raycaster.intersectObject( obj, true );

		if ( !intersection[0] ) return closestIntersection

		if ( !closestIntersection || intersection[0].distance < closestIntersection.distance ) {

			intersection[0].object = obj;

			return intersection[0]

		} else {

			return closestIntersection

		};

	}, null );

};
