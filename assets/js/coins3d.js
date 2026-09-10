const coinsContainer = document.getElementById("coins3d");

if (coinsContainer && window.THREE) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  camera.position.set(0, 0, 8.4);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  coinsContainer.appendChild(renderer.domElement);

  // Luzes
  scene.add(new THREE.AmbientLight(0xffffff, 0.74));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
  keyLight.position.set(4, 5, 6);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0x88aaff, 0.55, 30);
  fillLight.position.set(-4, -2, 4);
  scene.add(fillLight);

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function makeCoinTexture(symbol) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      10,
      size / 2,
      size / 2,
      size / 2
    );

    gradient.addColorStop(0, "#4a4a4a");
    gradient.addColorStop(1, "#101010");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
    ctx.fill();

    // Borda externa
    ctx.strokeStyle = "#5b5b5b";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();

    // Borda interna
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 22, 0, Math.PI * 2);
    ctx.stroke();

    // Símbolo
    ctx.fillStyle = "#d7d7d7";
    ctx.font = "bold 116px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, size / 2, size / 2 + 7);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;

    return texture;
  }

  const symbols = ["✕", "◌", "⬡", "△", "₥", "≈", "◎", "∅", "✦"];

  /*
    Moedas com espaçamento igual em volta do texto.
    Todas têm o mesmo tamanho e ficam distribuídas em uma elipse.
  */
  const radiusX = 2.65;
  const radiusY = 2.25;

  const slots = symbols.map((_, index) => {
    const angle = -Math.PI / 2 + (index / symbols.length) * Math.PI * 2;

    return {
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
      s: 1.00,
      z: Math.sin(angle) * 0.10
    };
  });

  const coinGroups = [];
  const coinMeshes = [];

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);

  slots.forEach((slot, index) => {
    const texture = makeCoinTexture(symbols[index % symbols.length]);

    // Moeda fina
    const geometry = new THREE.CylinderGeometry(0.62, 0.62, 0.055, 96);

    /*
      Rotaciona a geometria para a face ficar virada para a câmera.
      Assim o giro no próprio eixo funciona corretamente.
    */
    geometry.rotateX(Math.PI / 2);

    const faceMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.62,
      roughness: 0.32,
      emissive: 0x1c1c1c,
      emissiveMap: texture,
      emissiveIntensity: 0.16,
      transparent: true,
      opacity: 1
    });

    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x262626,
      metalness: 0.88,
      roughness: 0.38,
      transparent: true,
      opacity: 1
    });

    const coin = new THREE.Mesh(geometry, [
      edgeMaterial,
      faceMaterial,
      faceMaterial
    ]);

    const group = new THREE.Group();

    group.position.set(slot.x, slot.y, slot.z);
    group.scale.setScalar(slot.s);

    // Inclinação fixa
    group.rotation.x = -0.08;
    group.rotation.y = -0.22;
    group.rotation.z = -0.02;

    group.add(coin);
    scene.add(group);

    group.userData = {
      baseX: slot.x,
      baseY: slot.y,
      baseZ: slot.z,
      baseScale: slot.s,
      drift: index * 0.45,
      orbitOffset: Math.atan2(slot.y, slot.x),
      distance: Math.hypot(slot.x, slot.y),
      coin,

      // Controle do giro no hover
      currentSpin: 0,
      targetSpin: 0,
      wasHovered: false
    };

    coin.userData.group = group;

    coinGroups.push(group);
    coinMeshes.push(coin);
  });

  const mouse = { x: 0, y: 0 };
  const smoothMouse = { x: 0, y: 0 };

  let scrollY = window.scrollY;
  let smoothScroll = window.scrollY;

  window.addEventListener("mousemove", (event) => {
    mouse.x = event.clientX / window.innerWidth - 0.5;
    mouse.y = event.clientY / window.innerHeight - 0.5;

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener("mouseleave", () => {
    pointer.x = -10;
    pointer.y = -10;
  });

  window.addEventListener("scroll", () => {
    scrollY = window.scrollY;
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.06;
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.06;
    smoothScroll += (scrollY - smoothScroll) * 0.08;

    /*
      0 = topo da página
      1 = moedas expandidas e sumindo
    */
    const hideProgress = clamp(smoothScroll / 430, 0, 1);

    /*
      Suaviza a expansão no scroll.
    */
    const expandProgress =
      hideProgress * hideProgress * (3 - 2 * hideProgress);

    /*
      Primeiro expande, depois some.
    */
    const fadeProgress = clamp((hideProgress - 0.35) / 0.65, 0, 1);

    coinsContainer.style.opacity = String(clamp(1 - fadeProgress * 1.25, 0, 1));

    camera.position.z = 8.4 - expandProgress * 0.75;

    /*
      VELOCIDADE DAS MOEDAS EM VOLTA DO TEXTO:
      menor = mais lento
      maior = mais rápido
    */
    const orbitSpeed = 0.085;
    const globalOrbit = time * orbitSpeed + expandProgress * 0.45;

    /*
      Detecta qual moeda está embaixo do mouse.
    */
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(coinMeshes, false);
    const hoveredCoin = intersects.length ? intersects[0].object : null;

    coinGroups.forEach((group) => {
      const data = group.userData;
      const coin = data.coin;

      /*
        Movimento circular suave ao redor do texto.
      */
      const cos = Math.cos(globalOrbit);
      const sin = Math.sin(globalOrbit);

      const orbitX = data.baseX * cos - data.baseY * sin;
      const orbitY = data.baseX * sin + data.baseY * cos;

      /*
        Profundidade travada para não mudar a inclinação com o tempo.
      */
      const depthWave = 0;

      /*
        Direção para a moeda fugir para a borda no scroll.
      */
      const len = Math.hypot(orbitX, orbitY) || 1;
      const dirX = orbitX / len;
      const dirY = orbitY / len;

      const outwardX = dirX * expandProgress * 5.8;
      const outwardY = dirY * expandProgress * 3.6;

      /*
        Movimento leve para não ficar robótico.
      */
      const floatX = Math.sin(time * 0.55 + data.drift) * 0.035;
      const floatY = Math.cos(time * 0.62 + data.drift) * 0.045;

      /*
        Profundidade travada para manter a mesma inclinação.
      */
      const floatZ = 0;

      group.position.x = orbitX + outwardX + floatX;
      group.position.y = orbitY + outwardY + floatY;
      group.position.z =
        data.baseZ + depthWave - expandProgress * 1.15 + floatZ;

      /*
        Inclinação fixa.
        Não muda com mouse nem com tempo.
      */
      group.rotation.x = -0.08;
      group.rotation.y = -0.22;
      group.rotation.z = -0.02;

      /*
        HOVER:
        - moeda fica parada normalmente
        - quando o mouse entra nela, dá 1 giro completo
        - enquanto o mouse continua em cima, não gira infinitamente
        - se o mouse sair e entrar de novo, dá mais 1 giro
      */
      const isHovered = hoveredCoin === coin && hideProgress < 0.9;

      const spinRemaining = Math.abs(data.targetSpin - data.currentSpin);
      const spinFinished = spinRemaining < 0.001;

      if (isHovered && !data.wasHovered && spinFinished) {
        data.targetSpin += Math.PI * 2;
      }

      data.wasHovered = isHovered;

      /*
        VELOCIDADE DO GIRO NO HOVER:
        menor = mais lento
        maior = mais rápido
      */
      data.currentSpin += (data.targetSpin - data.currentSpin) * 0.030;

      coin.rotation.y = data.currentSpin;

      /*
        Remove alteração de inclinação da moeda.
      */
      coin.rotation.x = 0;
      coin.rotation.z = 0;

      /*
        Mantém todas do mesmo tamanho.
        Todas crescem juntas no scroll.
      */
      const scrollScale = 1 + expandProgress * 1.50;

      group.scale.setScalar(data.baseScale * scrollScale);

      /*
        Opacidade:
        desaparecem completamente no scroll.
      */
      const opacity = clamp(1 - fadeProgress * 1.25, 0, 1);

      coin.material[0].opacity = opacity;
      coin.material[1].opacity = opacity;
      coin.material[2].opacity = opacity;

      group.visible = opacity > 0.02;
    });

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}