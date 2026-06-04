/* ============================================================
   SIMULADOR DE PLANIFICACIÓN DEL BRAZO DEL DISCO
   Estefani Sánchez Lozano · Keirys Julieth Rodríguez Gómez
   Universidad Simón Bolívar · Sede Cúcuta
   ============================================================ */

'use strict';

// ── Variables globales ──────────────────────────────────────────────────────
let graficoPrincipal = null;   // Instancia Chart.js principal
let graficoComparacion = null; // Instancia Chart.js comparación
let ultimoResultado = null;    // Último resultado de simulación
let ultimosDatos = null;       // Últimos datos ingresados

// ── Tooltips de ayuda ──────────────────────────────────────────────────────
const TOOLTIPS = {
  cola: {
    titulo: 'Cola de Solicitudes',
    texto: 'Es la lista de cilindros que el cabezal del disco debe visitar. Cada número representa la posición de un cilindro en el disco (entre 0 y el máximo). Escríbelos separados por comas. Ejemplo: 98, 183, 37, 122, 14, 124, 65, 67'
  },
  posicion: {
    titulo: 'Posición Inicial del Cabezal',
    texto: 'Es el número de cilindro donde está ubicado el cabezal antes de iniciar la atención de solicitudes. Desde aquí comenzará a desplazarse para atender la cola. Ejemplo: 53'
  },
  maximo: {
    titulo: 'Cilindro Máximo',
    texto: 'Indica el número del cilindro más externo del disco (límite físico). En algoritmos como SCAN, el cabezal llega hasta este punto antes de invertir su dirección. Valor típico: 199 (disco de 200 cilindros, numerados del 0 al 199).'
  },
  algoritmo: {
    titulo: 'Algoritmo de Planificación',
    texto: 'Define la estrategia que el sistema operativo usará para decidir el orden en que el cabezal atiende las solicitudes. Cada algoritmo tiene distintas características de eficiencia y equidad.'
  },
  direccion: {
    titulo: 'Dirección Inicial del Cabezal',
    texto: 'Solo aplicable a SCAN y LOOK. Indica hacia qué lado se moverá el cabezal al comenzar la simulación. "Hacia arriba" significa que se moverá hacia cilindros de mayor número primero; "hacia abajo" hacia cilindros de menor número.'
  }
};

// ── Algoritmos de planificación ─────────────────────────────────────────────

/**
 * FCFS – First Come, First Served
 * Atiende las solicitudes exactamente en el orden en que llegaron.
 */
function fcfs(solicitudes, inicio) {
  const orden = [inicio, ...solicitudes];
  let total = 0;
  const movimientos = [];
  for (let i = 1; i < orden.length; i++) {
    const dist = Math.abs(orden[i] - orden[i - 1]);
    total += dist;
    movimientos.push({ desde: orden[i - 1], hasta: orden[i], distancia: dist });
  }
  return { orden, total, movimientos };
}

/**
 * SSTF – Shortest Seek Time First
 * En cada paso elige la solicitud no atendida más cercana al cabezal.
 */
function sstf(solicitudes, inicio) {
  const pendientes = [...solicitudes];
  const orden = [inicio];
  let posicion = inicio;
  let total = 0;
  const movimientos = [];

  while (pendientes.length > 0) {
    // Encontrar el cilindro más cercano
    let minDist = Infinity;
    let minIdx = -1;
    for (let i = 0; i < pendientes.length; i++) {
      const d = Math.abs(pendientes[i] - posicion);
      if (d < minDist) { minDist = d; minIdx = i; }
    }
    const siguiente = pendientes.splice(minIdx, 1)[0];
    movimientos.push({ desde: posicion, hasta: siguiente, distancia: minDist });
    total += minDist;
    posicion = siguiente;
    orden.push(siguiente);
  }
  return { orden, total, movimientos };
}

/**
 * SCAN – Algoritmo del Elevador
 * El cabezal se mueve en una dirección atendiendo solicitudes, llega al
 * extremo del disco y luego invierte.
 */
function scan(solicitudes, inicio, direccion, maxCilindro) {
  const arriba = solicitudes.filter(c => c >= inicio).sort((a, b) => a - b);
  const abajo  = solicitudes.filter(c => c < inicio).sort((a, b) => b - a);

  let secuencia;
  if (direccion === 'arriba') {
    // Va hasta maxCilindro, luego baja
    secuencia = [...arriba, maxCilindro, ...abajo];
  } else {
    // Va hasta 0, luego sube
    secuencia = [...abajo, 0, ...arriba];
  }

  const orden = [inicio];
  let posicion = inicio;
  let total = 0;
  const movimientos = [];

  for (const cil of secuencia) {
    const dist = Math.abs(cil - posicion);
    movimientos.push({ desde: posicion, hasta: cil, distancia: dist });
    total += dist;
    posicion = cil;
    orden.push(cil);
  }
  return { orden, total, movimientos };
}

/**
 * LOOK – Variante optimizada de SCAN
 * Como SCAN pero el cabezal no va hasta el extremo físico; solo llega
 * hasta la última solicitud en esa dirección.
 */
function look(solicitudes, inicio, direccion) {
  const arriba = solicitudes.filter(c => c >= inicio).sort((a, b) => a - b);
  const abajo  = solicitudes.filter(c => c < inicio).sort((a, b) => b - a);

  let secuencia;
  if (direccion === 'arriba') {
    secuencia = [...arriba, ...abajo];
  } else {
    secuencia = [...abajo, ...arriba];
  }

  const orden = [inicio];
  let posicion = inicio;
  let total = 0;
  const movimientos = [];

  for (const cil of secuencia) {
    const dist = Math.abs(cil - posicion);
    movimientos.push({ desde: posicion, hasta: cil, distancia: dist });
    total += dist;
    posicion = cil;
    orden.push(cil);
  }
  return { orden, total, movimientos };
}

// ── Validación de entradas ──────────────────────────────────────────────────
function validarEntradas() {
  const colaStr = document.getElementById('input-cola').value.trim();
  const posStr  = document.getElementById('input-posicion').value.trim();
  const maxStr  = document.getElementById('input-maximo').value.trim();

  if (!colaStr) { mostrarError('La cola de solicitudes no puede estar vacía.'); return null; }

  const solicitudes = colaStr.split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));

  if (solicitudes.length === 0) { mostrarError('Ingresa al menos un cilindro válido en la cola.'); return null; }

  const inicio = parseInt(posStr, 10);
  if (isNaN(inicio) || inicio < 0) { mostrarError('La posición inicial del cabezal debe ser un número mayor o igual a 0.'); return null; }

  const maximo = parseInt(maxStr, 10);
  if (isNaN(maximo) || maximo < 1) { mostrarError('El cilindro máximo debe ser un número mayor a 0.'); return null; }

  if (inicio > maximo) { mostrarError('La posición inicial no puede ser mayor que el cilindro máximo.'); return null; }

  const invalidos = solicitudes.filter(c => c < 0 || c > maximo);
  if (invalidos.length > 0) { mostrarError(`Los cilindros ${invalidos.join(', ')} están fuera del rango [0, ${maximo}].`); return null; }

  const algoritmo = document.getElementById('input-algoritmo').value;
  const direccion = document.querySelector('input[name="direccion"]:checked')?.value || 'arriba';

  return { solicitudes, inicio, maximo, algoritmo, direccion };
}

// ── Ejecutar simulación principal ──────────────────────────────────────────
function ejecutarSimulacion() {
  const datos = validarEntradas();
  if (!datos) return;

  ultimosDatos = datos;

  // Cambiar estado a ejecutando
  setBadgeEstado('ejecutando');
  document.getElementById('btn-ejecutar').disabled = true;

  // Breve delay visual para sensación de "procesando"
  setTimeout(() => {
    const resultado = ejecutarAlgoritmo(datos);
    ultimoResultado = resultado;

    renderizarRecorrido(resultado, datos);
    renderizarGraficoPrincipal(resultado, datos);
    renderizarResultados(resultado, datos);
    setBadgeEstado('completado');
    document.getElementById('btn-ejecutar').disabled = false;

    // También ejecutar comparación automática
    compararTodos(false);

    // Scroll suave hacia los resultados
    setTimeout(() => {
      document.getElementById('seccion-analisis').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
  }, 400);
}

// ── Ejecutar un algoritmo según la selección ─────────────────────────────────
function ejecutarAlgoritmo(datos) {
  const { solicitudes, inicio, maximo, algoritmo, direccion } = datos;
  switch (algoritmo) {
    case 'fcfs': return { ...fcfs(solicitudes, inicio), algoritmo: 'FCFS' };
    case 'sstf': return { ...sstf(solicitudes, inicio), algoritmo: 'SSTF' };
    case 'scan': return { ...scan(solicitudes, inicio, direccion, maximo), algoritmo: 'SCAN' };
    case 'look': return { ...look(solicitudes, inicio, direccion), algoritmo: 'LOOK' };
    default: return { ...fcfs(solicitudes, inicio), algoritmo: 'FCFS' };
  }
}

// ── Renderizar recorrido visual paso a paso ──────────────────────────────────
function renderizarRecorrido(resultado, datos) {
  const contenedor = document.getElementById('recorrido-visual');
  const { orden, movimientos } = resultado;

  // Mostrar métricas live
  const live = document.getElementById('metricas-live');
  live.style.display = 'flex';
  document.getElementById('ml-posicion').textContent = orden[orden.length - 1];
  document.getElementById('ml-paso').textContent = movimientos.length;
  document.getElementById('ml-distancia').textContent = resultado.total;

  let html = '<div class="recorrido-nodos">';

  for (let i = 0; i < orden.length; i++) {
    const cil = orden[i];
    const esInicio = i === 0;
    const esUltimo = i === orden.length - 1;
    const clase = esInicio ? 'nodo-inicio' : (esUltimo ? 'nodo-activo' : 'nodo-normal');
    const etiqueta = esInicio ? 'Inicio' : `Paso ${i}`;

    html += `<div class="recorrido-nodo" style="animation-delay:${i * 60}ms">
      <div class="nodo-circulo ${clase}">${cil}</div>
      <div class="nodo-etiqueta">${etiqueta}</div>
    </div>`;

    if (i < movimientos.length) {
      const dist = movimientos[i].distancia;
      const dir = movimientos[i].hasta > movimientos[i].desde ? '→' : '←';
      html += `<div class="recorrido-flecha" style="animation-delay:${i * 60 + 30}ms">
        <div class="flecha-linea"></div>
        <div class="flecha-dist">${dir}${dist}</div>
      </div>`;
    }
  }

  html += '</div>';
  contenedor.innerHTML = html;
}

// ── Renderizar gráfico Chart.js principal ────────────────────────────────────
function renderizarGraficoPrincipal(resultado, datos) {
  const { orden } = resultado;

  // Ocultar placeholder
  document.getElementById('chart-placeholder').style.display = 'none';

  // Destruir gráfico anterior si existe
  if (graficoPrincipal) { graficoPrincipal.destroy(); graficoPrincipal = null; }

  const ctx = document.getElementById('grafico-principal').getContext('2d');

  const labels = orden.map((_, i) => i === 0 ? 'Inicio' : `Paso ${i}`);
  const data   = orden.map(c => c);

  graficoPrincipal = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Recorrido ${resultado.algoritmo}`,
        data,
        borderColor: '#00B4D8',
        backgroundColor: 'rgba(0,180,216,0.10)',
        pointBackgroundColor: data.map((_, i) =>
          i === 0 ? '#FFD166' : (i === data.length - 1 ? '#06D6A0' : '#00B4D8')
        ),
        pointBorderColor: '#0A192F',
        pointRadius: 6,
        pointHoverRadius: 9,
        borderWidth: 2.5,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 1000, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          labels: { color: '#8892B0', font: { family: 'Space Mono', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#112240',
          borderColor: '#00B4D8',
          borderWidth: 1,
          titleColor: '#00B4D8',
          bodyColor: '#E6F1FF',
          callbacks: {
            label: ctx => ` Cilindro: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8892B0', font: { family: 'Space Mono', size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Orden de Atención', color: '#8892B0', font: { size: 11 } }
        },
        y: {
          ticks: { color: '#8892B0', font: { family: 'Space Mono', size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Número de Cilindro', color: '#8892B0', font: { size: 11 } }
        }
      }
    }
  });
}

// ── Renderizar resultados derecha ─────────────────────────────────────────────
function renderizarResultados(resultado, datos) {
  document.getElementById('resultados-placeholder').style.display = 'none';
  const cont = document.getElementById('resultados-contenido');
  cont.style.display = 'block';

  // Nombre algoritmo
  document.getElementById('res-algoritmo-nombre').textContent = resultado.algoritmo;

  // Métricas con animación
  animarContador('res-recorrido', resultado.total, '');
  animarContador('res-movimientos', resultado.movimientos.length, '');
  const promedio = (resultado.total / resultado.movimientos.length).toFixed(1);
  animarContador('res-promedio', parseFloat(promedio), '');

  // Eficiencia: comparar con FCFS como baseline (mayor es mejor relativo a FCFS)
  const baselineFCFS = fcfs(datos.solicitudes, datos.inicio).total;
  const eficiencia = Math.max(0, Math.min(100, Math.round((1 - (resultado.total - baselineFCFS) / Math.max(baselineFCFS, 1)) * 100)));
  document.getElementById('res-eficiencia').textContent = `${eficiencia}%`;

  // Orden de atención
  const lista = document.getElementById('orden-lista');
  lista.innerHTML = '';
  const { orden, movimientos } = resultado;

  for (let i = 0; i < orden.length; i++) {
    const div = document.createElement('div');
    div.className = 'orden-item' + (i === 0 ? ' orden-inicio' : '');
    div.style.animationDelay = `${i * 40}ms`;

    const distTexto = i > 0 ? `+${movimientos[i-1].distancia}` : '';
    const dir = i > 0 ? (movimientos[i-1].hasta > movimientos[i-1].desde ? '↑' : '↓') : '';

    div.innerHTML = `
      <span class="orden-num">${i}</span>
      <span class="orden-flecha">${dir || '◎'}</span>
      <span class="orden-cil">Cilindro ${orden[i]}</span>
      <span class="orden-dist">${distTexto}</span>
    `;
    lista.appendChild(div);
  }
}

// ── Comparar todos los algoritmos ────────────────────────────────────────────
function compararTodos(scrollear = true) {
  const datos = validarEntradas();
  if (!datos) return;

  ultimosDatos = datos;

  const algoritmos = [
    { key: 'fcfs', nombre: 'FCFS', fn: () => fcfs(datos.solicitudes, datos.inicio) },
    { key: 'sstf', nombre: 'SSTF', fn: () => sstf(datos.solicitudes, datos.inicio) },
    { key: 'scan', nombre: 'SCAN', fn: () => scan(datos.solicitudes, datos.inicio, datos.direccion, datos.maximo) },
    { key: 'look', nombre: 'LOOK', fn: () => look(datos.solicitudes, datos.inicio, datos.direccion) }
  ];

  const resultados = algoritmos.map(a => {
    const r = a.fn();
    return { nombre: a.nombre, key: a.key, total: r.total, movimientos: r.movimientos.length, orden: r.orden };
  });

  // Encontrar el mejor (menor recorrido total)
  const menorTotal = Math.min(...resultados.map(r => r.total));
  const mejor = resultados.find(r => r.total === menorTotal);

  // Mostrar sección
  document.getElementById('comparacion-placeholder').style.display = 'none';
  document.getElementById('comparacion-contenido').style.display = 'block';

  // Renderizar tabla
  const tbody = document.getElementById('tabla-body');
  tbody.innerHTML = '';

  resultados.forEach(r => {
    const esMejor = r.total === menorTotal;
    const promedio = (r.total / r.movimientos).toFixed(1);
    const eficiencia = calcularEficiencia(r.total, resultados);

    const tr = document.createElement('tr');
    if (esMejor) tr.classList.add('fila-mejor');
    tr.innerHTML = `
      <td class="td-algoritmo ${esMejor ? 'td-mejor' : ''}">${r.nombre}</td>
      <td class="${esMejor ? 'td-mejor' : ''}">${r.total}</td>
      <td>${r.movimientos}</td>
      <td>${promedio}</td>
      <td>${eficiencia}%</td>
      <td>${esMejor
        ? '<span class="badge-mejor">★ Mejor</span>'
        : '<span class="badge-normal">Normal</span>'
      }</td>
    `;
    tbody.appendChild(tr);
  });

  // Gráfico de barras comparativo
  renderizarGraficoComparacion(resultados, menorTotal);

  // Análisis automático
  renderizarAnalisis(resultados, mejor, datos);

  if (scrollear) {
    setTimeout(() => {
      document.getElementById('seccion-comparacion').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }
}

// ── Calcular eficiencia relativa ──────────────────────────────────────────────
function calcularEficiencia(total, todos) {
  const max = Math.max(...todos.map(r => r.total));
  const min = Math.min(...todos.map(r => r.total));
  if (max === min) return 100;
  return Math.round(((max - total) / (max - min)) * 100);
}

// ── Gráfico de barras comparativo ────────────────────────────────────────────
function renderizarGraficoComparacion(resultados, menorTotal) {
  if (graficoComparacion) { graficoComparacion.destroy(); graficoComparacion = null; }

  const ctx = document.getElementById('grafico-comparacion').getContext('2d');
  const colores = {
    FCFS: 'rgba(0,180,216,0.8)',
    SSTF: 'rgba(58,134,255,0.8)',
    SCAN: 'rgba(6,214,160,0.8)',
    LOOK: 'rgba(255,209,102,0.8)'
  };

  graficoComparacion = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: resultados.map(r => r.nombre),
      datasets: [{
        label: 'Recorrido Total (cilindros)',
        data: resultados.map(r => r.total),
        backgroundColor: resultados.map(r =>
          r.total === menorTotal
            ? 'rgba(6,214,160,0.9)'
            : colores[r.nombre] || 'rgba(136,146,176,0.5)'
        ),
        borderColor: resultados.map(r =>
          r.total === menorTotal ? '#06D6A0' : 'transparent'
        ),
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 800 },
      plugins: {
        legend: {
          labels: { color: '#8892B0', font: { family: 'Space Mono', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#112240',
          borderColor: '#00B4D8',
          borderWidth: 1,
          titleColor: '#00B4D8',
          bodyColor: '#E6F1FF',
          callbacks: {
            label: ctx => ` Recorrido: ${ctx.parsed.y} cilindros`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8892B0', font: { family: 'Space Mono', size: 12, weight: 'bold' } },
          grid:  { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#8892B0', font: { family: 'Space Mono', size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.06)' },
          title: { display: true, text: 'Cilindros recorridos', color: '#8892B0', font: { size: 11 } }
        }
      }
    }
  });
}

// ── Análisis automático ───────────────────────────────────────────────────────
function renderizarAnalisis(resultados, mejor, datos) {
  document.getElementById('analisis-placeholder').style.display = 'none';
  document.getElementById('analisis-contenido').style.display = 'block';

  const peor = resultados.reduce((a, b) => a.total > b.total ? a : b);
  const diferencia = peor.total - mejor.total;
  const porcentajeMejora = Math.round((diferencia / peor.total) * 100);

  const colaStr = datos.solicitudes.join(', ');

  // Análisis principal
  document.getElementById('analisis-texto-principal').innerHTML = `
    <h4>Análisis General</h4>
    <p>Para la cola de solicitudes <strong>[${colaStr}]</strong> con posición inicial del cabezal en el cilindro <strong>${datos.inicio}</strong>, 
    el algoritmo <strong>${mejor.nombre}</strong> presentó el menor recorrido total del cabezal con un desplazamiento de <strong>${mejor.total} cilindros</strong>. 
    Esto representa una mejora de <strong>${porcentajeMejora}%</strong> respecto al algoritmo con mayor recorrido (<strong>${peor.nombre}</strong> con ${peor.total} cilindros). 
    En este escenario específico, <strong>${mejor.nombre}</strong> es la opción más eficiente.</p>
  `;

  // Análisis SSTF vs FCFS
  const resFCFS = resultados.find(r => r.nombre === 'FCFS');
  const resSSTF = resultados.find(r => r.nombre === 'SSTF');
  const difFCFS_SSTF = resFCFS.total - resSSTF.total;

  document.getElementById('analisis-texto-2').innerHTML = `
    <h4>SSTF vs FCFS</h4>
    <p>SSTF redujo el recorrido en <strong>${difFCFS_SSTF} cilindros</strong> respecto a FCFS al priorizar los cilindros más cercanos. 
    Sin embargo, esta ganancia de eficiencia tiene el costo potencial de <strong>inanición</strong> en solicitudes de cilindros extremos. 
    FCFS, aunque menos eficiente, garantiza que toda solicitud es atendida en orden de llegada.</p>
  `;

  // Análisis SCAN vs LOOK
  const resSCAN = resultados.find(r => r.nombre === 'SCAN');
  const resLOOK = resultados.find(r => r.nombre === 'LOOK');
  const difSCAN_LOOK = resSCAN.total - resLOOK.total;
  const dirTexto = datos.direccion === 'arriba' ? 'ascendente' : 'descendente';

  document.getElementById('analisis-texto-3').innerHTML = `
    <h4>SCAN vs LOOK</h4>
    <p>En dirección <strong>${dirTexto}</strong>, LOOK mejoró a SCAN en <strong>${difSCAN_LOOK} cilindros</strong> al no desplazarse hasta el extremo 
    físico del disco. LOOK es generalmente preferible a SCAN en entornos donde las solicitudes no alcanzan los bordes del disco, como ocurre en este conjunto de datos.</p>
  `;
}

// ── Contador animado ─────────────────────────────────────────────────────────
function animarContador(elementId, valorFinal, sufijo) {
  const elem = document.getElementById(elementId);
  const duracion = 800;
  const inicio = performance.now();
  const valorInicial = 0;

  function step(timestamp) {
    const progreso = Math.min((timestamp - inicio) / duracion, 1);
    const easing = 1 - Math.pow(1 - progreso, 3); // ease-out-cubic
    const valor = Math.round(valorInicial + (valorFinal - valorInicial) * easing);
    elem.textContent = valor + sufijo;
    if (progreso < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Estado del badge ─────────────────────────────────────────────────────────
function setBadgeEstado(estado) {
  const badge = document.getElementById('sim-estado-badge');
  badge.className = 'estado-badge';
  if (estado === 'ejecutando') {
    badge.classList.add('estado-ejecutando');
    badge.textContent = 'Ejecutando…';
  } else if (estado === 'completado') {
    badge.classList.add('estado-completado');
    badge.textContent = 'Completado';
  } else {
    badge.classList.add('estado-espera');
    badge.textContent = 'En espera';
  }
}

// ── Mostrar/ocultar info items ────────────────────────────────────────────────
function toggleInfo(id) {
  const elem = document.getElementById(id);
  const toggle = elem.parentElement.querySelector('.info-toggle');
  elem.classList.toggle('open');
  toggle.textContent = elem.classList.contains('open') ? '−' : '+';
}

// ── Tooltip popup ─────────────────────────────────────────────────────────────
function abrirTooltip(key) {
  const data = TOOLTIPS[key];
  if (!data) return;
  document.getElementById('tooltip-content').innerHTML = `
    <h3>${data.titulo}</h3>
    <p>${data.texto}</p>
  `;
  document.getElementById('tooltip-popup').classList.add('open');
  document.getElementById('tooltip-overlay').classList.add('open');
}

function cerrarTooltip() {
  document.getElementById('tooltip-popup').classList.remove('open');
  document.getElementById('tooltip-overlay').classList.remove('open');
}

// ── Error visual ──────────────────────────────────────────────────────────────
function mostrarError(msg) {
  // Crear notificación toast
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--error); color: #fff; padding: 12px 24px;
    border-radius: 8px; font-family: var(--font-mono); font-size: 13px;
    z-index: 9999; box-shadow: 0 8px 24px rgba(239,71,111,0.4);
    animation: fadeSlideUp 0.3s ease both;
    max-width: 90%; text-align: center;
  `;
  toast.textContent = '⚠ ' + msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Visibilidad del campo dirección según algoritmo ──────────────────────────
function actualizarVisibilidadDireccion() {
  const algoritmo = document.getElementById('input-algoritmo').value;
  const grupo = document.getElementById('group-direccion');
  grupo.style.display = (algoritmo === 'scan' || algoritmo === 'look') ? 'flex' : 'none';
}

// ── Inicialización ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Escuchar cambio de algoritmo para mostrar/ocultar dirección
  document.getElementById('input-algoritmo').addEventListener('change', actualizarVisibilidadDireccion);

  // Botones de tooltip
  document.querySelectorAll('.tooltip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirTooltip(btn.dataset.tip);
    });
  });

  // Enter en inputs para ejecutar
  ['input-cola', 'input-posicion', 'input-maximo'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') ejecutarSimulacion();
    });
  });

  // Inicializar visibilidad
  actualizarVisibilidadDireccion();

  // Animación de entrada para las tarjetas de algoritmos
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.algo-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 100}ms`;
    card.style.animationPlayState = 'paused';
    observer.observe(card);
  });

  // Ejecutar simulación inicial con los datos de ejemplo
  setTimeout(() => {
    ejecutarSimulacion();
  }, 800);
});
