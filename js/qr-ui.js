function addQRButton(route){

  const old = document.getElementById("qrBtn");
  if(old) old.remove();

  const btn = document.createElement("button");
  btn.id = "qrBtn";
  btn.className = "fab-scan";
  btn.innerText = "📷";

  btn.onclick = () => {
    startQRScanner((code) => {
      handleScan(route, code);
    });
  };

  document.body.appendChild(btn);
}

function handleScan(route, code){

  if(route === "sales"){
    const product = PRODUCTS.find(p => p.barcode == code);
    if(product) addToCart(product.barcode);
  }

  if(route === "inventory"){
    document.getElementById("barcode").value = code;
  }

  if(route === "products"){
    document.getElementById("search").value = code;
  }

  if(route === "returns"){
    alert("Return scan: " + code);
  }

  if(route === "reports"){
    alert("Report scan: " + code);
  }

}