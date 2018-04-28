const fetch = require('node-fetch');
const player = require('play-sound')(opts = {
    player: 'mplayer', // 'C:\\Program Files\\mplayer\\Mplayer.exe'
});
const firebase = require("firebase");

const config = {
    apiKey: "AIzaSyD7Xcrs5ywIe9KPavSCg2xC_x2P2a3vHnE",
    authDomain: "api-project-723460605643.firebaseapp.com",
    databaseURL: "https://api-project-723460605643.firebaseio.com",
    projectId: "api-project-723460605643",
    storageBucket: "api-project-723460605643.appspot.com",
    messagingSenderId: "723460605643"
};
firebase.initializeApp(config);

const songDb = firebase.database().ref('songs');
let currentProcess;
let songs = [];
let index = 0;

songDb.set("");

songDb.on('value', function(snapshot) {
    const val = snapshot.val();

    if (val) {
        if (currentProcess) {
            currentProcess.removeListener('exit', playNextSongs);
            currentProcess.kill();
        }

        if (val.startsWith('停止')) {
            return;
        } else if (val.startsWith('下一首')) {
            playNextSongs();
        } else {
            const searchTerm = encodeURIComponent(val);

            search(searchTerm).then((result) => {
                songs = result.songs;
                index = -1;
                playNextSongs();
            });
        }
    }
});

function playNextSongs()  {
    index += 1;
    if (index  < songs.length) {
        console.log(songs);
        const song = songs[index];
        console.log('index:' + index);
        console.log('song: ' + song.mid);
        getSongAddress(song.mid).then((address) => {
            console.log('address: ' + address);
            currentProcess = player.play(address, (err) => {
                if (err && !err.killed) {
                    console.log(err);
                    throw err
                }
            });
            currentProcess.on('exit', playNextSongs);
        });
    }
}

function search(q, page = 1) {
    const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?ct=24&qqmusic_ver=1298&new_json=1&remoteplace=txt.yqq.center&searchid=37602803789127241&t=0&aggr=1&cr=1&catZhida=1&lossless=0&flag_qc=0&p=${page}&n=20&w=${q.toString('utf8')}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
    return fetch(url)
        .then(r => r.json())
        .then(({ data: { song: songList } }) => ({
            songs: songList.list.map(({
                                          singer: singerList, name: song, mid, album, id: songId,
                                      }) => {
                const singer = singerList.map(({ name }) => name).join(' ');
                const imageId = album.id;
                return {
                    singer, song, songId, imageId, mid,
                };
            }),
        }))
        .catch((e) => {
            console.log(e);
            return {
                songs: [],
            };
        });
}

function parseJsonP(value) {
    return JSON.parse(value.replace(`$jsonCallback(`, '').slice(0, -1));
}

function getSongAddress(mid) {
    const t = (new Date).getUTCMilliseconds();
    const guid = (Math.round(2147483647 * Math.random()) * t) % 1e10;
    const fileName = `C200${mid}.m4a`;
    const url = `http://base.music.qq.com/fcgi-bin/fcg_musicexpress.fcg?json=3&guid=${guid}&g_tk=938407465&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf8&platform=yqq&jsonpCallback=&needNewCode=0`;
    console.log(url);
    return fetch(url)
        .then(res => res.text())
        .then(text => {
            if (text.startsWith('jsonCallback')) {
                return JSON.parse(parseJsonP(text));
            } else {
                return JSON.parse(text);
            }
        })
        .then((key) => {
            console.log('key: ' + key.key);
            return key.key
        })
        .then((vkey) => {
            const address = `http://dl.stream.qqmusic.qq.com/${fileName}?vkey=${vkey}&guid=${guid}&fromtag=52`;
            console.log(address);
            return address;
        }).catch(e =>  {
            console.log(e);
        });
}
