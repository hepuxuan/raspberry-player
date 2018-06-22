const fetch = require('node-fetch');
const flatten = require('lodash/flatten')
const player = require('play-sound')(opts = {
    player: 'mplayer', // 'C:\Program Files\mplayer\Mplayer.exe'
});
const firebase = require("firebase");
const HttpsProxyAgent = require('https-proxy-agent');

const config = {
    apiKey: "AIzaSyD7Xcrs5ywIe9KPavSCg2xC_x2P2a3vHnE",
    authDomain: "api-project-723460605643.firebaseapp.com",
    databaseURL: "https://api-project-723460605643.firebaseio.com",
    projectId: "api-project-723460605643",
    storageBucket: "api-project-723460605643.appspot.com",
    messagingSenderId: "723460605643"
};
firebase.initializeApp(config);

const songDb = firebase.database().ref('song');
const commandDb = firebase.database().ref('command');
const currentSongDb = firebase.database().ref('current');
let currentProcess;
let songs = [];
let index = -1;

songDb.set("");
commandDb.set("");
currentSongDb.set("");

commandDb.on('value', function(snapshot) {
    const val = snapshot.val();

    if (val) {
        if (val.startsWith('stop')) {
            if (currentProcess) {
                currentProcess.removeListener('exit', playNextSongs);
                currentProcess.kill();
                currentProcess = null;
            }
            currentSongDb.set("");
            return;
        } else if (val.startsWith('next_song')) {
            playNextSongs();
        } else if (val.startsWith('play_list')) {
            getPlayList().then((result) => {
                songs = result;
                index = -1;
                playNextSongs();
            });
        } else if (val.startsWith('play')) {
            songDb.once('value', function (songSnapshot) {
                const searchTerm = encodeURIComponent(songSnapshot.val());

                search(searchTerm).then((result) => {
                    songs = result.songs;
                    index = -1;
                    playNextSongs();
                });
            });
        }
    }
});

function playNextSongs()  {
    index += 1;
    if (index  < songs.length) {
        const song = songs[index];
        currentSongDb.set(song.song);
        getSongAddress(song.mid).then((address) => {
            if (currentProcess) {
                currentProcess.removeListener('exit', playNextSongs);
                currentProcess.kill();
                currentProcess = null;
            }
            currentProcess = player.play(address, (err) => {
                if (err && !err.killed) {
                    console.log('err: ' + err);
                    // throw err
                }
            });
            currentProcess.on('exit', playNextSongs);
        }).catch(playNextSongs);
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

function getPlayList() {
    const url = 'https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=5381&uin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=h5&needNewCode=1&_=1512554796112%E4%BD%9C%E8%80%85%EF%BC%9Acode_mcx%E9%93%BE%E6%8E%A5%EF%BC%9Ahttps://juejin.im/post/5a35228e51882506a463b172';
    return fetch(url)
        .then(r => r.json())
        .then(({ data: { topList } }) => Promise.all(topList.slice(0, 5).map(({ id }) => {
            const url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?g_tk=5381&uin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=h5&needNewCode=1&tpl=3&page=detail&type=top&topid=${id}`;

            return fetch(url).then(res => res.json()).then(data => data.songlist.map(({ data: { songname, songmid } }) => ({
                song: songname,
                mid: songmid,
            })));
        })))
        .then(flatten);

}

function getSongAddress(mid) {
    const t = (new Date).getUTCMilliseconds();
    const guid = (Math.round(2147483647 * Math.random()) * t) % 1e10;
    const fileName = `C200${mid}.m4a`;
    const url = `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?uin=0&g_tk=1278911659&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&jsonpCallback=MusicJsonCallback&notice=0&platform=yqq&needNewCode=0&cid=205361747&uin=0&songmid=${mid}4&filename=${fileName}&guid=${guid}`;
    return fetch(url, {
        agent: new HttpsProxyAgent('http://111.230.166.51:3128'),
        headers: {
            Referer: 'https://y.qq.com/portal/player.html',
            Host: 'y.qq.com',
            Origin: 'https://y.qq.com',
        },
    }).then(res => res.json())
        .then(res => {
            console.log(res.data.items[0].vkey);
            return res.data.items[0].vkey
        })
        .then((vkey) => `http://dl.stream.qqmusic.qq.com/${fileName}?vkey=${vkey}&guid=${guid}&uin=0&fromtag=66`);
}
