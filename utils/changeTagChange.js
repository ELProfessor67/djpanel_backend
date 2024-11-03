const id3 = require('node-id3');
const autoDJListModel = require('../models/autoDJList');
const path = require('path');


async function changeAllSongsTags(_id) {
    console.log('changing songs title...')
    const songs = await autoDJListModel.findOne({owner: _id}).populate('songs.data').sort({ 'songs.index': -1 });
    for (let index = 0; index < songs.length; index++) {
        const song = songs[index];

        const filePath = path.join(__dirname,`./public/${song.audio}`);

        // Metadata to be updated
        const tags = {
          title: song._id.toString(),
          artist: '_id',
          album: song._id.toString()
        };
        
        // Update the metadata
        id3.write(tags, filePath, (err) => {
          if (err) {
            console.error('Error updating metadata:', err);
          } else {
            console.log('Metadata updated successfully!');
          }
        });
    }
    console.log('changed songs title...')
}

changeAllSongsTags('655347b59c00a7409d9181c3');