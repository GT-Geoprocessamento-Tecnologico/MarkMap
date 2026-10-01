import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MeshView } from "../../lib/mesh/mesh-store";

interface MeshCanvasProps {
  blob: Blob;
  view: MeshView;
  onError: (message: string) => void;
}
function dispose(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}
function disposeWireframe(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.LineSegments)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

export function MeshCanvas({ blob, view, onError }: MeshCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const meshRootRef = useRef<THREE.Object3D | null>(null);
  const wireframeRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const viewRef = useRef(view);
  const centerRef = useRef(new THREE.Vector3());
  const sizeRef = useRef(new THREE.Vector3(1, 1, 1));
  viewRef.current = view;
  const applyCamera = (
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    next: MeshView["camera"],
  ) => {
    const center = centerRef.current;
    const size = sizeRef.current;
    const aspect = Math.max(camera.aspect, 0.25);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const extent =
      next === "top"
        ? Math.max(size.x, size.z)
        : next === "front"
          ? Math.max(size.x, size.y)
          : size.length();
    const distance = Math.max(
      (extent / (2 * Math.tan(fov / 2))) * Math.max(1, 1 / aspect) * 1.35,
      0.1,
    );
    camera.position.copy(center);
    if (next === "top") camera.position.y += distance;
    else if (next === "front") camera.position.z += distance;
    else
      camera.position.add(
        new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(distance),
      );
    controls.target.copy(center);
    camera.updateProjectionMatrix();
    controls.update();
  };
  const applyMaterialView = (next: MeshView) => {
    meshRootRef.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        const meshMaterial = material as THREE.Material & {
          wireframe?: boolean;
        };
        if ("wireframe" in meshMaterial) meshMaterial.wireframe = false;
        meshMaterial.opacity = next.wireframe
          ? next.opacity * 0.16
          : next.opacity;
        meshMaterial.transparent = next.wireframe || next.opacity < 1;
        meshMaterial.needsUpdate = true;
      });
    });
    if (wireframeRef.current) {
      wireframeRef.current.visible = next.wireframe;
      wireframeRef.current.traverse((object) => {
        if (
          object instanceof THREE.LineSegments &&
          object.material instanceof THREE.LineBasicMaterial
        )
          object.material.opacity = next.opacity;
      });
    }
  };
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onError("Este dispositivo não oferece WebGL para visualizar a malha.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x08121d, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.replaceChildren(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xd9f4ff, 0x25324a, 2.4));
    scene.add(new THREE.AmbientLight(0x8ab4d8, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(4, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x63b3ed, 1.8);
    fill.position.set(-5, 3, -4);
    scene.add(fill);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10_000);
    cameraRef.current = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;
    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      const previousAspect = camera.aspect;
      camera.aspect = width / height;
      if (
        meshRootRef.current &&
        camera.aspect < previousAspect &&
        camera.aspect < 1
      ) {
        const ratio =
          Math.max(1, 1 / camera.aspect) / Math.max(1, 1 / previousAspect);
        camera.position
          .sub(controls.target)
          .multiplyScalar(ratio)
          .add(controls.target);
        camera.far = Math.max(
          camera.far,
          camera.position.distanceTo(controls.target) * 10,
        );
      }
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const contextLost = (event: Event) => {
      event.preventDefault();
      if (!disposed)
        onError(
          "O contexto WebGL foi perdido. Recarregue a malha para tentar novamente.",
        );
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const load = async () => {
      try {
        const loaded = await new GLTFLoader().parseAsync(
          await blob.arrayBuffer(),
          "",
        );
        if (disposed) {
          dispose(loaded.scene);
          return;
        }
        const box = new THREE.Box3();
        let meshes = 0;
        loaded.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            meshes += 1;
            box.expandByObject(object);
          }
        });
        if (
          meshes === 0 ||
          box.isEmpty() ||
          !box.min.toArray().every(Number.isFinite) ||
          !box.max.toArray().every(Number.isFinite)
        ) {
          dispose(loaded.scene);
          throw new Error("A malha não contém geometria finita renderizável.");
        }
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        centerRef.current.copy(center);
        sizeRef.current.copy(size);
        camera.near = Math.max(size.length() / 10_000, 0.001);
        camera.far = Math.max(size.length() * 100, 100);
        meshRootRef.current = loaded.scene;
        scene.add(loaded.scene);
        loaded.scene.updateMatrixWorld(true);
        const wireframe = new THREE.Group();
        loaded.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const lines = new THREE.LineSegments(
            new THREE.WireframeGeometry(object.geometry),
            new THREE.LineBasicMaterial({
              color: 0x67e8f9,
              transparent: true,
              opacity: viewRef.current.opacity,
              depthTest: true,
              toneMapped: false,
            }),
          );
          lines.matrixAutoUpdate = false;
          lines.matrix.copy(object.matrixWorld);
          wireframe.add(lines);
        });
        wireframe.visible = viewRef.current.wireframe;
        wireframeRef.current = wireframe;
        scene.add(wireframe);
        applyMaterialView(viewRef.current);
        applyCamera(camera, controls, viewRef.current.camera);
        renderer.domElement.dataset.meshReady = "true";
      } catch (error) {
        if (!disposed)
          onError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a malha GLB.",
          );
      }
    };
    void load();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      controls.dispose();
      if (meshRootRef.current) dispose(meshRootRef.current);
      if (wireframeRef.current) {
        disposeWireframe(wireframeRef.current);
        scene.remove(wireframeRef.current);
      }
      renderer.dispose();
      meshRootRef.current = null;
      wireframeRef.current = null;
      host.replaceChildren();
    };
  }, [blob, onError]);
  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (camera && controls && meshRootRef.current)
      applyCamera(camera, controls, view.camera);
  }, [view.camera]);
  useEffect(() => {
    applyMaterialView(viewRef.current);
  }, [view.opacity, view.wireframe]);
  return (
    <div
      ref={hostRef}
      className="absolute inset-0 min-h-0"
      aria-label="Visualização 3D da malha"
    />
  );
}
