async function loadReports() {

  const res = await api("getReports");

  const ctx = document.getElementById("salesChart");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: res.days,
      datasets: [{
        label: "Sales",
        data: res.sales
      }]
    }
  });

}