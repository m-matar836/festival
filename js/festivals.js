let FESTIVALS = [];

async function loadFestivals(){

    const res = await api(
        "getFestivals"
    );

    if(!res.success){

        alert(res.message);

        return;

    }

    FESTIVALS = res.festivals;

    renderFestivals(FESTIVALS);

}

function renderFestivals(data){

    const table =
    document.getElementById(
        "festivalTable"
    );

    table.innerHTML="";

    data.forEach(f=>{

        table.innerHTML += `

        <tr>

            <td>${f.code}</td>

            <td>${f.name}</td>

            <td>${f.governorate}</td>

            <td>${f.coordinator}</td>

            <td>

                <span class="status ${f.status}">

                    ${f.status}

                </span>

            </td>

            <td>

                <button onclick="editFestival('${f.id}')">

                    Edit

                </button>

            </td>

        </tr>

        `;

    });

}

function openFestivalModal(){

    document
    .getElementById(
        "festivalModal"
    )
    .style.display="flex";

}

function closeFestivalModal(){

    document
    .getElementById(
        "festivalModal"
    )
    .style.display="none";

}

async function saveFestival(){

    const data={

        name:
        festivalName.value,

        governorate:
        governorate.value,

        area:
        area.value,

        warehouse:
        warehouse.value,

        coordinator:
        coordinator.value,

        startDate:
        startDate.value,

        endDate:
        endDate.value,

        startTime:
        startTime.value,

        endTime:
        endTime.value,

        notes:
        festivalNotes.value

    };

    const res =
    await api(
        "addFestival",
        data
    );

    if(!res.success){

        alert(res.message);

        return;

    }

    closeFestivalModal();

    loadFestivals();

}