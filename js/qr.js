let qrScanner;

function startQRScanner(onScan){

  const modal = document.createElement("div");
  modal.id = "qrModal";
  modal.style = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,0.85);
    display:flex;
    justify-content:center;
    align-items:center;
    z-index:99999;
  `;

  modal.innerHTML = `<div id="qr-reader" style="width:320px"></div>`;
  document.body.appendChild(modal);

  qrScanner = new Html5Qrcode("qr-reader");

  qrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      stopQRScanner();
      onScan(decodedText);
    }
  ).catch(err=>{
    console.error(err);
    stopQRScanner();
  });
}

function stopQRScanner(){
  if(qrScanner){
    qrScanner.stop().catch(()=>{});
    qrScanner = null;
  }

  const m = document.getElementById("qrModal");
  if(m) m.remove();
}

function handleScan(route, code){

  if(route === "sales"){

    const product = PRODUCTS.find(p => p.barcode == code);
    if(product) addToCart(product.barcode);

  }

  if(route === "inventory"){

    const input = document.getElementById("barcode");
    if(input) input.value = code;

  }

  if(route === "products"){

    const input = document.getElementById("search");
    if(input) input.value = code;

  }

  if(route === "returns"){
    alert("Return scan: " + code);
  }

  if(route === "reports"){
    alert("Report scan: " + code);
  }
}