const id3 = require('node-id3');
const autoDJListModel = require('../models/autoDJList');
const path = require('path');
const fs = require('fs');


async function changeAllSongsTags(_id) {
    console.log('changing songs title...')
    const {songs} = await autoDJListModel.findOne({owner: _id}).populate('songs.data').sort({ 'songs.index': -1 });
 
    for (let index = 0; index < songs.length; index++) {
        const {data:song} = songs[index];

        const filePath = path.join(__dirname,`../public/${song.audio}`);

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

async function createplaylist(_id) {
    console.log('creating playlist...')

    const {songs} = await autoDJListModel.findOne({owner: _id}).populate('songs.data').sort({ 'songs.index': -1 });
    let playlistData = ""
    for (let index = 0; index < songs.length; index++) {
        const {data:song} = songs[index];
        const songPath = path.join(__dirname,`../public/${song.audio}`);
        playlistData += `${songPath}\n`;
    }
    const playlistPath = path.join(__dirname,`../playlist.m3u`);
    fs.writeFileSync(playlistPath,playlistData)
    console.log('playlist created successfully ...')
}

module.exports = {changeAllSongsTags,createplaylist}