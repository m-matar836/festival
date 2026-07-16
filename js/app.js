document.addEventListener("DOMContentLoaded", startApp);
async function loadSidebar(){

    const response =
    await fetch(
        "components/sidebar.html"
    );

    const html =
    await response.text();

    document.getElementById(
        "sidebar"
    ).innerHTML = html;

}

async function startApp(){

    await initDB();

    const user = getSession();

    if(!user){
        location.href = "index.html";
        return;
    }

    document.getElementById("currentUser").innerText =
        user.username;

    await loadSidebar();

    navigate("dashboard");
}

window.addEventListener("online", syncQueue);

setInterval(syncQueue, 5000);


startApp();