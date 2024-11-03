const axios = require('axios');

const ICECAST_URL = "https://icecast.hgdjlive.com/status-json.xsl";
const SERVER_URL = "https://backend.hgdjlive.com/api/v1/change-metadata";

let lastTitle = ""; 

function checkIcecastMetadata() {
    axios.get(ICECAST_URL)
        .then(response => {
            const data = response.data;

            // Navigate to the first mount point in the JSON structure
            const source = data.icestats && data.icestats.source 
                ? (Array.isArray(data.icestats.source) ? data.icestats.source[0] : data.icestats.source)
                : null;

            if (source && source.title) {
                const currentTitle = source.title;

                // Check if the title has changed
                if (currentTitle !== lastTitle) {
                    lastTitle = currentTitle; // Update last title
                    const [_,_id] = currentTitle?.split('-');
                    console.log(_id)
                    axios.post(SERVER_URL,{songId:_id.trim()}).then(res => console.log(res.data)).catch(ee => console.log())
                }
            } else {
                console.log("No active stream or metadata available.");
            }
        })
        .catch(error => {
            console.error("Error fetching metadata:", error.message);
        });
}

// Call the function every second
setInterval(checkIcecastMetadata, 1000);
