// ============================================================================
// 무대 소품 도구 견본 (4차 M1, 사람 확인·자가 점검용 스니펫) — 앱 코드가 아니다
// ----------------------------------------------------------------------------
// 왜: M1 은 무대 '틀'만 만든다(카페·분리배출장은 M2·M3). 틀이 품질 규칙(M §6 Q1~Q5·Q7)을 지키는지
//   카페를 다 짓기 전에 한 장면에서 보려고 재질 14종·둥근 상자·회전체·관·접지 그림자·강조·김·음료 줄기를 한 탁자에 모았다.
// 쓰는 법: http://127.0.0.1:8000/firstperson/ 을 열고 개발자 도구 콘솔에 이 파일 내용을 통째로 붙여 넣는다.
//   바로 견본 무대로 들어간다(사진 자세 'wide'). 자세 바꾸기: FPStage.shot('metal') · 'clear' · 'paper'. 나가기: Esc.
//   나온 뒤 FPStage.lastRestoreDiff 가 [] 면 렌더러 값이 세계 값으로 다 돌아온 것이다(마스터 §6-14).
// firstperson/index.html 에 넣지 말 것(빌더 FP_JS 목록에도 넣지 않는다) — 단일 HTML 크기에 들어가지 않는다.
// ============================================================================
(() => {
  FPStage.register('kit', {
    title: '소품 견본',
    exposure: 1.0,
    build(kit) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe9e2d6);
      const camera = new THREE.PerspectiveCamera(45, 1, 0.03, 30);
      kit.lightRig(scene, {
        size: [4, 3], sun: { dir: [-0.5, 1, 0.55], intensity: 2.0 },
        points: [{ pos: [-0.8, 1.9, 0.4], intensity: 2.5 }, { pos: [0.9, 1.9, 0.2], intensity: 2.5 }],
      });
      const M = kit.mesh;
      // 바닥(헤링본 타일) · 뒷벽(회반죽) · 옆벽(나무 판재)
      M(kit.roundedBox(4, 0.04, 3, 0.004, 2), kit.matOf('tile', { noise: { pattern: 'herringbone', count: 8, color1: '#cbb79a', color2: '#b59d7e', altShare: 0.5 }, repeat: [1, 1] }), { pos: [0, -0.02, 0], cast: false, parent: scene });
      M(kit.roundedBox(4, 2.6, 0.08, 0.01, 2), kit.matOf('plaster', { repeat: [2, 1.3] }), { pos: [0, 1.3, -1.5], cast: false, parent: scene });
      M(kit.roundedBox(0.06, 2.6, 3, 0.01, 2), kit.matOf('wood', { noise: { planks: 8 } }), { pos: [-2, 1.3, 0], cast: false, parent: scene });
      // 탁자: 나무 상판(두께 4 cm, 모서리 1 cm) + 금속 다리 4개
      const table = new THREE.Group(); scene.add(table);
      M(kit.roundedBox(1.8, 0.04, 0.8, 0.01, 4), kit.mat.wood, { pos: [0, 0.75, 0], parent: table });
      for (const [x, z] of [[-0.82, -0.32], [0.82, -0.32], [-0.82, 0.32], [0.82, 0.32]]) M(kit.roundedBox(0.04, 0.73, 0.04, 0.008, 3), kit.mat.brushedSteel, { pos: [x, 0.365, z], parent: table });
      kit.groundShadow(table, [2.0, 1.0], { y: 0, opacity: 0.35 });
      const TOP = 0.77;
      const props = [];
      const place = (obj, x, z, size, pick) => { obj.position.set(x, TOP, z); scene.add(obj); kit.groundShadow(obj, size, { y: TOP }); if (pick) obj.userData.pick = pick; props.push(obj); return obj; };
      // 텀블러: 헤어라인 스테인리스 몸체 + 실리콘 띠 + 무광 뚜껑
      const tum = new THREE.Group();
      M(kit.lathe([[0.034, 0], [0.036, 0.004], [0.037, 0.08], [0.04, 0.17], [0.04, 0.18]], 64), kit.mat.brushedSteel, { parent: tum });
      M(kit.lathe([[0.0385, 0.06], [0.0392, 0.065], [0.0395, 0.095], [0.0388, 0.1]], 64), kit.mat.rubber, { parent: tum });
      M(kit.lathe([[0.041, 0.178], [0.042, 0.19], [0.036, 0.205], [0.0, 0.207]], 64), kit.matOf('plasticMatte', { color: 0x2f3b36, roughness: 0.45 }), { parent: tum });
      place(tum, -0.55, 0.05, 0.1, { label: '텀블러', order: 1 });
      // 크롬 주전자(거울 금속)
      const pit = new THREE.Group();
      M(kit.lathe([[0.04, 0], [0.05, 0.02], [0.052, 0.09], [0.044, 0.13], [0.046, 0.15]], 64), kit.mat.chrome, { parent: pit });
      M(kit.tube([[0.05, 0.12, 0], [0.085, 0.1, 0], [0.085, 0.04, 0], [0.05, 0.03, 0]], 0.006), kit.mat.chrome, { parent: pit });
      place(pit, -0.3, -0.18, 0.12);
      // 일회용 투명 컵(PET, 돔 뚜껑) + 빨대
      const cup = new THREE.Group();
      M(kit.lathe([[0.0, 0.0], [0.028, 0.0], [0.03, 0.004], [0.045, 0.14]], 64, { sharp: true }), kit.mat.clearPET, { parent: cup });
      M(kit.lathe([[0.047, 0.138], [0.048, 0.146], [0.04, 0.17], [0.012, 0.19], [0.0, 0.19]], 64), kit.mat.clearPET, { parent: cup });
      M(kit.lathe([[0.0, 0.0], [0.026, 0.0], [0.028, 0.004], [0.0375, 0.09], [0.0, 0.09]], 48, { sharp: true }), kit.mat.liquidCoffee, { parent: cup });
      M(kit.tube([[0.005, 0.03, 0], [0.006, 0.2, 0], [0.012, 0.24, 0]], 0.0035), kit.matOf('plasticMatte', { color: 0x3f7a55, roughness: 0.35 }), { parent: cup });
      place(cup, -0.05, 0.08, 0.1, { label: '일회용 컵', order: 2 });
      // 유리병
      const bottle = M(kit.lathe([[0.0, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.14], [0.026, 0.18], [0.013, 0.21], [0.013, 0.24]], 64), kit.mat.glass);
      place(bottle, 0.18, -0.15, 0.08);
      // 도자기 잔 + 커피 + 크레마 + 김
      const mug = new THREE.Group();
      M(kit.lathe([[0.0, 0.0], [0.035, 0.0], [0.04, 0.01], [0.042, 0.085], [0.04, 0.09], [0.036, 0.086], [0.036, 0.012], [0.0, 0.012]], 64, { sharp: true }), kit.mat.ceramic, { parent: mug });
      M(kit.tube([[0.04, 0.07, 0], [0.065, 0.065, 0], [0.066, 0.035, 0], [0.04, 0.025, 0]], 0.006), kit.mat.ceramic, { parent: mug });
      const crema = M(new THREE.CircleGeometry(0.0358, 48), kit.mat.crema, { parent: mug, rot: [-Math.PI / 2, 0, 0], pos: [0, 0.078, 0] });
      crema.receiveShadow = true;
      place(mug, 0.42, 0.1, 0.1, { label: '도자기 잔', order: 3 });
      const st = kit.steam({ origin: [0.42, TOP + 0.09, 0.1], count: 30 });
      scene.add(st.obj);
      // 음료 줄기(물, 반투명) — 병 위에서 아래로
      const pour = kit.pourStream({ from: [0.62, TOP + 0.42, -0.15], to: [0.62, TOP + 0.02, -0.15], r: 0.003, color: 0xcfe6f2, opacity: 0.55 });
      scene.add(pour.obj);
      pour.start(400);
      // 종이 상자 · 골판지 상자 · 고무 매트 · 사출 플라스틱 통
      place(M(kit.roundedBox(0.16, 0.1, 0.12, 0.004), kit.mat.paper), 0.62, 0.22, 0.2);
      const cb = M(kit.roundedBox(0.26, 0.16, 0.2, 0.006), kit.mat.cardboard); cb.position.y = 0.08;
      const cbg = new THREE.Group(); cbg.add(cb); place(cbg, 0.66, -0.12, 0.3, { label: '골판지 상자', order: 4 });
      const mat = M(kit.roundedBox(0.4, 0.008, 0.28, 0.003), kit.mat.rubber); mat.position.y = 0.004;
      const mg = new THREE.Group(); mg.add(mat); place(mg, -0.28, 0.2, 0.42);
      const bin = M(kit.roundedBox(0.16, 0.2, 0.14, 0.02, 5), kit.matOf('plasticMatte', { color: 0x3c7fb0 })); bin.position.y = 0.1;
      const bg = new THREE.Group(); bg.add(bin); place(bg, -0.75, -0.2, 0.2, { label: '플라스틱 통', order: 5 });
      return {
        scene, camera,
        shots: {
          wide: { pos: [0, 1.45, 1.75], target: [0, 0.8, 0], fov: 45 },
          metal: { pos: [-0.42, 1.0, 0.45], target: [-0.45, 0.85, -0.05], fov: 40 },
          clear: { pos: [0.05, 0.98, 0.5], target: [0.05, 0.86, -0.05], fov: 40 },
          paper: { pos: [0.45, 1.05, 0.62], target: [0.6, 0.82, 0.0], fov: 42 },
        },
        pick(o) { kit.arc(o, null, [o.position.x, o.position.y, o.position.z], 0.12, 500); },
      };
    },
  });
  if (!FPStage.active()) FPStage.enter('kit', { shot: 'wide', instant: true });
  return '견본 무대: FPStage.shot("metal" | "clear" | "paper" | "wide"), 나가기 Esc';
})();
