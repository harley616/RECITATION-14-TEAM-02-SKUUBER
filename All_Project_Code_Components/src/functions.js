

async function renderPopup() {
  let data
  const location = document.getElementById('location');
  console.log("renderPopup was called!");
  await axios({
    url: ` http://api.weatherapi.com/v1/forcast.json?key=${session.env.API_KEY}?q=${location.innerHTML}`,
    method: 'GET',
    dataType: 'json',
    headers: {
      'Accept-Encoding': 'application/json',
    },
    params: {
      apikey: process.env.API_KEY,
      keyword: 'Drake', //you can choose any artist/event here
      size: 10,
    },
  })
    .then(results => {
      console.log("query results", results.data); // the results will be displayed on the terminal if the docker containers are running // Send some parameters
      data = results.data;
    })
    .catch(error => {
      // Handle errors
      console.log("There was and error!", error);
    });
  const popup = document.getElementById('weather-popup');
  popup.style.display = 'block';
};

