function exportInvoice(invoice, items, total){

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: "mm",
    format: [80, 200]
  });

  let y = 10;

  doc.setFontSize(10);
  doc.text("FESTIVAL POS", 10, y);
  y += 8;

  doc.text("Invoice: " + invoice, 10, y);
  y += 8;

  doc.text("----------------------", 10, y);
  y += 6;

  items.forEach(i=>{
    doc.text(
      `${i.name}`,
      10,
      y
    );
    y += 5;

    doc.text(
      `${i.qty} x ${i.price} = ${i.qty * i.price}`,
      10,
      y
    );

    y += 6;
  });

  doc.text("----------------------", 10, y);
  y += 8;

  doc.text("TOTAL: " + total, 10, y);

  doc.save(invoice + ".pdf");
}

function printReceipt(invoice, items, total){

  let content = `
    <div style="width:280px;font-family:monospace">
    <h3>FESTIVAL POS</h3>
    <p>Invoice: ${invoice}</p>
    <hr>
  `;

  items.forEach(i=>{
    content += `
      <div>${i.name}</div>
      <div>${i.qty} x ${i.price}</div>
      <hr>
    `;
  });

  content += `<h3>Total: ${total}</h3></div>`;

  const win = window.open("");
  win.document.write(content);
  win.print();
  win.close();
}