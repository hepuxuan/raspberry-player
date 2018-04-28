const fetch = require('node-fetch');
const player = require('play-sound')(opts = {
    player: 'C:\\Program Files\\mplayer\\Mplayer.exe',
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
            currentProcess.removeListener('exit', playSongs);
            currentProcess.kill();
        }

        if (val.startsWith('停止')) {
            return;
        } else if (val.startsWith('下一首')) {
            index += 1 % songs.length;
            playSongs();
        } else {
            const searchTerm = encodeURIComponent(val);

            search(searchTerm).then((result) => {
                songs = result.songs;
                index = 0;
                playSongs();
            });
        }
    }
});

function playSongs()  {
    if (index  < songs.length) {
        const song = songs[index];
        getSongAddress(song.mid).then((address) => {
            currentProcess = player.play(address, (err) => {
                if (err && !err.killed) throw err
            });
            index += 1 % songs.length;
            currentProcess.on('exit', playSongs);
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

function getSongAddress(mid) {
    const t = (new Date).getUTCMilliseconds();
    const guid = (Math.round(2147483647 * Math.random()) * t) % 1e10;
    const fileName = `C200${mid}.m4a`;
    const url = `http://base.music.qq.com/fcgi-bin/fcg_musicexpress.fcg?json=3&guid=${guid}&g_tk=938407465&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf8&platform=yqq&jsonpCallback=&needNewCode=0`;
    return fetch(url)
        .then(res => res.json())
        .then(({ key }) => key)
        .then((vkey) => {
            const address = `http://dl.stream.qqmusic.qq.com/${fileName}?vkey=${vkey}&guid=${guid}&fromtag=52`;
            return address;
        });
}
