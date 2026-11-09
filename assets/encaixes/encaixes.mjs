const rect = (x, y, w, h) => `M${x} ${y}h${w}v${h}h-${w}Z`;
const piece = (name, path, x, y) => ({name, path, x, y});
const scenes = {
  'perfil-empresa-google': {
    sample: [805, 20],
    lines: [[0,851,1536,851,18]],
    parts: [
      piece('fachada','M390 549H835V594H808L787 694H799V851H426V694L450 594H390Z',-95,65),
      piece('cartão',rect(874,271,469,323),100,25),
      piece('marcador','M616 572C591 533 444 360 444 235C444 136 519 57 616 57C713 57 790 136 790 235C790 355 641 535 616 572ZM616 150A88 85 0 1 0 616 320A88 85 0 1 0 616 150Z',0,-130)
    ]
  },
  'portfolio-online': {
    sample: [700, 70],
    parts: [
      piece('quadro esquerdo',rect(189,342,368,376),-125,-45),
      piece('quadro central',rect(618,342,362,376),0,110),
      piece('quadro direito',rect(1033,342,380,376),125,-45)
    ]
  },
  'landing-page': {
    sample: [1380, 210],
    parts: [
      piece('cabeçalho',rect(449,74,648,335),-145,-24),
      piece('bloco de oferta',rect(489,408,561,229),140,-18),
      piece('bloco de apoio',rect(509,650,500,182),-120,18),
      piece('botão âmbar',rect(510,864,515,94),0,92)
    ]
  },
  'site-institucional': {
    sample: [20, 20],
    lines: [[197,0,197,1000,11],[0,550,1536,550,11],[1057,0,1057,775,14]],
    parts: [
      piece('navegador','M215 151Q215 99 267 99H1098Q1151 99 1151 151V706H215Z',-140,-90),
      piece('fachada','M286 654L337 637H994V668H1178V738L1100 793H1071V925H1090L1165 981H318L372 925H385V771H286Z',0,100),
      piece('celular','M1181 333Q1181 280 1236 280H1388Q1444 280 1444 333V770Q1444 823 1388 823H1236Q1181 823 1181 770Z',125,15)
    ]
  },
  'diagnostico-processos-ia': {
    sample: [680, 50],
    lines: [[772,332,1430,332,10],[405,538,1430,538,10],[772,740,1430,740,10]],
    parts: [
      ...[856,1072,1290].map((x,i)=>piece('registro superior '+(i+1),rect(x,272,i===2?132:128,124),-75+i*65,-95)),
      piece('registro do meio esquerdo',rect(856,477,130,126),-125,0),
      piece('registro do meio direito',rect(1291,477,133,127),110,0),
      ...[856,1070,1291].map((x,i)=>piece('registro inferior '+(i+1),rect(x,677,i===2?136:132,127),-80+i*65,110)),
      piece('registro âmbar',rect(1066,469,143,142),0,-155)
    ]
  }
};

const ns = 'http://www.w3.org/2000/svg';
let serial = 0;
function svg(name, attrs = {}) {
  const element = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

function makeScene(source, scene) {
  const id = 'dcm-art-' + (++serial);
  const art = svg('svg', {viewBox:'0 0 1536 1024', 'aria-hidden':'true', focusable:'false'});
  art.classList.add('dcm-encaixe__stage');
  const defs = svg('defs');
  const texture = svg('image', {id:id+'-source', href:source, width:1536, height:1024});
  const paper = svg('pattern', {id:id+'-paper',patternUnits:'userSpaceOnUse',width:100,height:100});
  paper.append(svg('use',{href:'#'+id+'-source',x:-scene.sample[0],y:-scene.sample[1]}));
  defs.append(texture,paper);
  const removed = svg('clipPath',{id:id+'-removed'});
  for (const part of scene.parts) removed.append(svg('path',{d:part.path,'clip-rule':'evenodd'}));
  defs.append(removed);
  art.append(defs,svg('use',{href:'#'+id+'-source'}));
  const patches = svg('g',{'clip-path':`url(#${id}-removed)`});
  patches.append(svg('rect',{width:1536,height:1024,fill:`url(#${id}-paper)`}));
  for(const [x1,y1,x2,y2,width] of scene.lines ?? []) {
    patches.append(svg('line',{x1,y1,x2,y2,stroke:'#181714','stroke-width':width}));
  }
  art.append(patches);
  const layers = scene.parts.map((part,index)=>{
    const cut = svg('clipPath',{id:id+'-cut-'+index});
    cut.append(svg('path',{d:part.path,'clip-rule':'evenodd'}));
    defs.append(cut);
    const layer = svg('g',{'data-piece':part.name});
    const pixels = svg('g',{'clip-path':`url(#${id}-cut-${index})`});
    pixels.append(svg('use',{href:'#'+id+'-source'}));
    layer.append(pixels);
    art.append(layer);
    return layer;
  });
  return {art,layers};
}

const instances = new WeakMap();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export async function animateServiceArt(frame) {
  if (!frame) return;
  instances.get(frame)?.();
  const image = frame.querySelector('img');
  const scene = scenes[frame.dataset.encaixe];
  if (!image || !scene || reduced.matches) return;
  let cancelled = false;
  let stage;
  let animations = [];
  const cleanup = () => {
    cancelled = true;
    stage?.remove();
    frame.classList.remove('dcm-encaixe--playing');
    for (const animation of animations) animation.cancel();
    if (instances.get(frame) === cleanup) instances.delete(frame);
    reduced.removeEventListener('change',cleanup);
  };
  instances.set(frame, cleanup);
  reduced.addEventListener('change',cleanup,{once:true});
  try {
    await image.decode();
    if (cancelled || !frame.getClientRects().length) { cleanup(); return; }
    const {art,layers} = makeScene(image.currentSrc || image.src,scene);
    stage = art;
    frame.append(stage);
    animations = layers.map((layer,index)=>{
      const {x,y} = scene.parts[index];
      return layer.animate([
        {transform:`translate(${x}px,${y}px)`},
        {transform:'translate(0px,0px)'}
      ],{duration:820,delay:index * (scene.parts.length > 5 ? 30 : 85),fill:'both',easing:'cubic-bezier(.22,.75,.28,1)'});
    });
    frame.classList.add('dcm-encaixe--playing');
    await Promise.all(animations.map(animation=>animation.finished));
  } catch {
    // The original stays available if decoding or animation fails.
  } finally {
    if (!cancelled) cleanup();
  }
}

export function stopServiceArt(frame) {
  instances.get(frame)?.();
}
