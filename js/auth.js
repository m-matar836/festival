function saveSession(user, token){
    sessionStorage.setItem(
        "festival_user",
        JSON.stringify({
            ...user,
            token: token
        })
    );
}

function getSession(){

    return JSON.parse(
        sessionStorage.getItem(
            "festival_user"
        )
    );

}

function logout(){

    sessionStorage.clear();

    location.href =
    "index.html";

}

function checkAuth(){

    const user =
    getSession();

    if(!user){

        location.href =
        "index.html";

    }

}