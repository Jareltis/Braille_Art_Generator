// Braille ASCII Art Generator - enhanced image adjustments (brightness, contrast, saturation, sharpness)
// This file expects HTML elements with IDs: file, outWidth, outHeight, keepAspect, threshold, thresholdVal,
// invert, generate, output, srcCanvas, editCanvas, resCanvas, downloadTxt, copy, downloadPng, fontSize,
// and the new controls: brightness, contrast, saturation, sharpness

(function(){
  // DOM refs
  const fileInput = document.getElementById('file');
  const outW = document.getElementById('outWidth');
  const outH = document.getElementById('outHeight');
  const keepAspect = document.getElementById('keepAspect');
  const thresholdEl = document.getElementById('threshold');
  const thresholdVal = document.getElementById('thresholdVal');
  const invertEl = document.getElementById('invert');
  const generateBtn = document.getElementById('generate');
  const outputPre = document.getElementById('output');
  const srcCanvas = document.getElementById('srcCanvas');
  const editCanvas = document.getElementById('editCanvas');
  const resCanvas = document.getElementById('resCanvas');
  const downloadTxt = document.getElementById('downloadTxt');
  const copyBtn = document.getElementById('copy');
  const downloadPng = document.getElementById('downloadPng');
  const fontSizeIn = document.getElementById('fontSize');

  // new controls
  const brightnessEl = document.getElementById('brightness');
  const contrastEl = document.getElementById('contrast');
  const saturationEl = document.getElementById('saturation');
  const sharpnessEl = document.getElementById('sharpness');

  let img = new Image();
  const srcCtx = srcCanvas.getContext('2d');
  const editCtx = editCanvas.getContext('2d');
  const resCtx = resCanvas.getContext('2d');

  thresholdEl && (thresholdEl.oninput = ()=> thresholdVal && (thresholdVal.textContent = thresholdEl.value));

  // load image and draw to srcCanvas (fit)
  fileInput && fileInput.addEventListener('change', async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    img = new Image();
    img.onload = ()=>{
      const maxW = 800; const maxH = 600; // allow larger preview
      let w = img.width, h = img.height;
      const scale = Math.min(maxW/w, maxH/h, 1);
      w = Math.round(w*scale); h = Math.round(h*scale);
      srcCanvas.width = w; srcCanvas.height = h;
      editCanvas.width = w; editCanvas.height = h; // edit canvas same size as source preview
      srcCtx.imageSmoothingEnabled = true;
      srcCtx.clearRect(0,0,w,h);
      srcCtx.drawImage(img,0,0,w,h);
      // init editCanvas as copy of src
      editCtx.clearRect(0,0,w,h);
      editCtx.drawImage(srcCanvas,0,0);
      // apply current adjustments to populate editCanvas
      applyAdjustments();
    };
    img.src = url;
  });

  // utility functions
  function rgbaToLuma(r,g,b){return 0.299*r + 0.587*g + 0.114*b}

  // apply brightness, contrast, saturation to srcCanvas -> editCanvas
  function applyAdjustments(){
    if(!srcCanvas.width || !srcCanvas.height) return;
    const w = srcCanvas.width, h = srcCanvas.height;
    // read source
    const srcData = srcCtx.getImageData(0,0,w,h);
    const dstData = editCtx.createImageData(w,h);
    const sdata = srcData.data;
    const ddata = dstData.data;

    // read control values
    const bright = (brightnessEl ? parseInt(brightnessEl.value) : 0); // -100..100
    const contrast = (contrastEl ? parseInt(contrastEl.value) : 0); // -100..100
    const sat = (saturationEl ? parseInt(saturationEl.value) : 0); // -100..100
    const sharp = (sharpnessEl ? parseFloat(sharpnessEl.value) : 0); // 0..5

    // map values
    const bAdd = bright * 2.55; // -255..255
    const cVal = contrast * 2.55; // -255..255 mapping
    const cFactor = (259 * (cVal + 255)) / (255 * (259 - cVal)); // standard
    const sFactor = sat / 100; // -1..1

    // first pass: brightness, contrast, saturation
    for(let i=0;i<sdata.length;i+=4){
      let r = sdata[i];
      let g = sdata[i+1];
      let b = sdata[i+2];
      // brightness
      r = r + bAdd; g = g + bAdd; b = b + bAdd;
      // contrast
      r = cFactor*(r - 128) + 128;
      g = cFactor*(g - 128) + 128;
      b = cFactor*(b - 128) + 128;
      // saturation: interpolate towards gray
      const gray = 0.299*r + 0.587*g + 0.114*b;
      r = gray + (r - gray) * (1 + sFactor);
      g = gray + (g - gray) * (1 + sFactor);
      b = gray + (b - gray) * (1 + sFactor);
      // clamp
      ddata[i] = Math.max(0, Math.min(255, Math.round(r)));
      ddata[i+1] = Math.max(0, Math.min(255, Math.round(g)));
      ddata[i+2] = Math.max(0, Math.min(255, Math.round(b)));
      ddata[i+3] = sdata[i+3];
    }

    // if sharpness > 0 -> apply convolution on dstData
    if(sharp > 0.01){
      const conv = convolveRGBA(dstData, sharp);
      editCtx.putImageData(conv, 0, 0);
    } else {
      editCtx.putImageData(dstData, 0, 0);
    }
  }

  // simple unsharp-like convolution for sharpening. amount ~ 0..5
  function convolveRGBA(imageData, amount){
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    const out = new ImageData(w,h);
    const dst = out.data;
    // kernel base: [[0,-1,0],[-1,5,-1],[0,-1,0]] scaled by amount
    // center = 5 + amount*2
    const center = 5 + amount*2;
    const kernel = [0, -1, 0, -1, center, -1, 0, -1, 0];
    // no normalization (sharpening)
    for(let y=0; y<h; y++){
      for(let x=0; x<w; x++){
        let r=0,g=0,b=0,a=0;
        let ki=0;
        for(let ky=-1; ky<=1; ky++){
          for(let kx=-1; kx<=1; kx++){
            const xx = Math.max(0, Math.min(w-1, x + kx));
            const yy = Math.max(0, Math.min(h-1, y + ky));
            const idx = (yy*w + xx) * 4;
            const kval = kernel[ki++];
            r += src[idx] * kval;
            g += src[idx+1] * kval;
            b += src[idx+2] * kval;
            a += src[idx+3] * kval;
          }
        }
        const idxOut = (y*w + x)*4;
        dst[idxOut] = Math.max(0, Math.min(255, Math.round(r)));
        dst[idxOut+1] = Math.max(0, Math.min(255, Math.round(g)));
        dst[idxOut+2] = Math.max(0, Math.min(255, Math.round(b)));
        dst[idxOut+3] = Math.max(0, Math.min(255, Math.round(a)));
      }
    }
    return out;
  }

  // generate Braille from a source canvas (edit canvas) instead of Image
  function generateBrailleFromCanvas(sourceCanvas, charsW, charsH, threshold, invert){
    const pxW = charsW * 2;
    const pxH = charsH * 4;
    // resize sourceCanvas into an offscreen canvas of pxW x pxH
    const off = document.createElement('canvas');
    off.width = pxW; off.height = pxH;
    const offCtx = off.getContext('2d');
    offCtx.imageSmoothingEnabled = true;
    // fit image preserving aspect
    const iw = sourceCanvas.width, ih = sourceCanvas.height;
    const scale = Math.min(pxW/iw, pxH/ih);
    const dw = Math.round(iw*scale), dh = Math.round(ih*scale);
    const dx = Math.round((pxW - dw)/2), dy = Math.round((pxH - dh)/2);
    offCtx.clearRect(0,0,pxW,pxH);
    offCtx.drawImage(sourceCanvas, 0,0,iw,ih, dx,dy,dw,dh);

    // show resized in resCanvas for preview
    resCanvas.width = pxW; resCanvas.height = pxH;
    resCtx.clearRect(0,0,pxW,pxH);
    resCtx.drawImage(off,0,0);

    const imgd = offCtx.getImageData(0,0,pxW,pxH).data;
    let out = '';
    for(let cy=0; cy<charsH; cy++){
      let line = '';
      for(let cx=0; cx<charsW; cx++){
        let mask = 0;
        for(let r=0;r<4;r++){
          for(let c=0;c<2;c++){
            const px = cx*2 + c;
            const py = cy*4 + r;
            const idx = (py*pxW + px) * 4;
            const rcol = imgd[idx];
            const gcol = imgd[idx+1];
            const bcol = imgd[idx+2];
            const l = rgbaToLuma(rcol,gcol,bcol);
            const dotOn = invert ? (l < threshold) : (l > threshold);
            if(dotOn){
              let dot;
              if(c===0){ dot = [1,2,3,7][r]; }
              else { dot = [4,5,6,8][r]; }
              mask |= (1 << (dot-1));
            }
          }
        }
        const ch = String.fromCharCode(0x2800 + mask);
        line += ch;
      }
      out += line + '\n';
    }
    return out;
  }

  // wire generate button to use editCanvas as source
  generateBtn && generateBtn.addEventListener('click', ()=>{
    if(!editCanvas || !editCanvas.width){alert('Сначала загрузите изображение');return}
    let w = parseInt(outW.value) || 80;
    let h = parseInt(outH.value) || 30;
    const thresh = parseInt(thresholdEl.value);
    const inv = invertEl.value === '1';
    if(keepAspect && keepAspect.checked){
      const pxW = w*2;
      const pxH = Math.round(editCanvas.height * (pxW / editCanvas.width));
      h = Math.max(1, Math.round(pxH / 4));
      outH.value = h;
    }
    w = Math.max(1, Math.min(400, w));
    h = Math.max(1, Math.min(400, h));
    const txt = generateBrailleFromCanvas(editCanvas, w, h, thresh, inv);
    outputPre.textContent = txt;
    outputPre.style.fontSize = fontSizeIn.value + 'px';
  });

  // attach adjustment inputs to live update
  const adjInputs = [brightnessEl, contrastEl, saturationEl, sharpnessEl];
  adjInputs.forEach(inp => {
    if(!inp) return;
    inp.addEventListener('input', ()=>{
      // apply adjustments; debounce lightweight
      applyAdjustments();
    });
  });

  // download as txt
  downloadTxt && downloadTxt.addEventListener('click', ()=>{
    const txt = outputPre.textContent || '';
    const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'braille.txt';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // copy
  copyBtn && copyBtn.addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(outputPre.textContent || '');
      copyBtn.textContent = 'Скопировано!';
      setTimeout(()=> copyBtn.textContent = 'Копировать', 1200);
    }catch(e){alert('Не удалось скопировать: ' + e)}
  });

  // download PNG: render output text to canvas and save
  downloadPng && downloadPng.addEventListener('click', ()=>{
    const txt = outputPre.textContent || '';
    if(!txt) return alert('Нет данных для экспорта');
    const lines = txt.split('\n');
    const fs = parseInt(fontSizeIn.value) || 12;
    const charW = Math.ceil(fs * 0.6);
    const charH = Math.ceil(fs * 0.95);
    const width = (lines[0]?.length || 0) * charW || 1;
    const height = lines.length * charH || 1;
    const c = document.createElement('canvas');
    c.width = Math.min(8192, width);
    c.height = Math.min(8192, height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#00121a'; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle = '#e6eef6'; ctx.font = fs + 'px monospace'; ctx.textBaseline = 'top';
    for(let i=0;i<lines.length;i++){
      ctx.fillText(lines[i], 0, i*charH + 1);
    }
    const url = c.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = 'braille.png'; document.body.appendChild(a); a.click(); a.remove();
  });

})();
