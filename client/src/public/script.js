const server = new WebSocket('ws://127.0.0.1:2222');
const user = {}, room = {
    players: []
};

server.onclose = close => {
    $('.error-head .error-title a').text('Disconnected');
    $('.error-head .error-desc').text(close && close.reason || 'Please reload the page!');
    $('.error-close').hide();
    $('#error-container').show();
    location.hash = '';
};
server.onerror = () => {
    $('.error-head .error-title a').text('Disconnected');
    $('.error-head .error-desc').text('Something went wrong! Please reload the page!');
    $('.error-close').hide();
    $('#error-container').show();
};
server.onopen = () => {
    $('.loading-container').hide();
    $('.menu-container').show();
    if (location.hash) {
        server.send(JSON.stringify({ type: 'room_list' }));
        room.roomID = location.hash.replace("#", "");
        server.send(JSON.stringify({ type: "room_check", roomID: room.roomID }));
    }
}
server.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === 'id') user.id = data.id;
    if (data.type === 'v') {
        console.log("Game Version: %c" + data.version, 'color: yellow');
        $('.menu-footer').append(`<p>Version: <a target="_blank" href="https://github.com/mrozio13pl/uno/releases/latest">${data.version}</a></p>`);
    }
    if (data.type === 'room_list') {
        $('.refresh').attr('disabled', true);
        setTimeout(() => {
            $('.refresh').attr('disabled', false);
        }, data.cooldown);
        $('.room-list').html('');
        if (!data.rooms.length) return $('.room-list').html('No rooms avainable :(');
        data.rooms.forEach(room => {
            $('.room-list').append(`<div class="item" data-id="${room.roomID}"><div><a title="${escapeHtml(room.roomName)}">${escapeHtml(room.roomName)}</a></div><div><a>Players ${room.playerCount}/4</a></div></div>`);
        });
        $('.room-list .item').click(item => {
            room.roomID = item.currentTarget.getAttribute('data-id');
            server.send(JSON.stringify({ type: "room_check", roomID: room.roomID }));
        })
    }
    if (data.type === 'room_check') {
        if (data.callback) {
            $("#menu-screen").hide();
            $("#games-container").hide();
            $('#nickname').show();
            $('.cancel').show();
            $(".nickname").focus();
            $(".room-settings").hide();
            user.action = 'join';
        } else error('Invalid Code', data.message)
    }
    if (data.type === 'my_cards') {
        $('.you .my-cards').html(null);
        data.cards.forEach(card => {
            if (!isNaN(card.number) && !card.ability) return $('.you .my-cards').append(`<div class="my-card num-${card.number} ${card.color}" data-ability data-color="${card.color}" data-number=${card.number}><span class="inner"><span class="mark">${card.number}</span></span></div>`);
            if (card.ability === 'plus4') return $('.you .my-cards').append(`<div class="my-card num-plus4 black" data-ability="plus4" data-color data-number><span class="inner"><span class="mark">+4</span></span></div>`);
            if (card.ability === 'plus2') return $('.you .my-cards').append(`<div class="my-card num-plus2 ${card.color}" data-ability="plus2" data-color="${card.color}" data-number><span class="inner"><span class="mark">+2</span></span></div>`);
            if (card.ability === 'reverse') return $('.you .my-cards').append(`<div class="my-card num-reverse ${card.color}" data-ability="reverse" data-color="${card.color}" data-number><span class="inner"><span class="mark">↩</span></span></div>`);
            if (card.ability === 'block') return $('.you .my-cards').append(`<div class="my-card num-block ${card.color}" data-ability="block" data-color="${card.color}" data-number><span class="inner"><span class="mark">🚫</span></span></div>`);
            if (card.ability === 'change') return $('.you .my-cards').append(`<div class="my-card num-change black" data-ability="change" data-color data-number><span class="inner"><span class="mark"><div class="change"><div class="segment yellow"></div><div class="segment green"></div><div class="segment blue"></div><div class="segment red"></div></div></span></span></div>`);
        });
        $('.my-cards .my-card').click(card => {
            user.push = {
                ability: card.currentTarget.getAttribute('data-ability') || null,
                color: card.currentTarget.getAttribute('data-color') || null,
                number: card.currentTarget.getAttribute('data-number') || null,
            };
            if (card.currentTarget.getAttribute('data-ability') === 'change' || card.currentTarget.getAttribute('data-ability') === 'plus4') $(".color-selector-container").show();
            else server.send(JSON.stringify({ type: 'action', card: user.push, action: 'place' }))
        });
        if (user.countdown) clearInterval(user.countdown);
        $('.timeout').text(null);
    }
    if (data.type === 'created_room') {
        $('.code h1').text(data.id);
        $('.limbo-admin').show();
    }
    if (data.type === 'joined_room') {
        $('#nickname').hide();
        $('#limbo').show();
        $('#room-code').text(data.id);
        location.hash = data.id;
        user.isConnected = true;
    }
    if (data.type === 'room') {
        if (!data.room.isRunning) {
            if (room.players.length !== data.room.players.length || user.roomID !== data.room.roomID) {
                room.players = data.room.players;
                user.roomID = room.roomID;
                $('.limbo-player-list').html('');
                room.players.forEach(player => {
                    $('.limbo-player-list').append(`<div class="limbo-player-item"${user.action === 'create' ? ` data-id="${player.id}"` : ''}>${escapeHtml(player.nickname)}</div>`);
                    if (user.action === 'create') $('.limbo-player-list .limbo-player-item').click(element => {
                        $(".kick-accept").off('click');
                        $(".kick-accept").click(()=>{
                            server.send(JSON.stringify({ type: 'kick', id: element.currentTarget.getAttribute('data-id') }));
                            $("#player-management-container").hide();
                        });
                        $(".kick-decline").click(()=>{
                            $("#player-management-container").hide();
                        });
                        $("#player-management-container .kick-head .kick-desc a").text(element.currentTarget.textContent);
                        $("#player-management-container").show();
                    })
                });
                if (user.action === 'create') $('.limbo-player-item').css({ 'pointer-events': 'all', cursor: 'pointer' });
                else $('.limbo-player-item').css({ 'pointer-events': 'none', cursor: 'none' });
            }
        } else {
            if (!isNaN(data.room.centerCard.number) && !data.room.centerCard.ability) $('.center .center-card').html(`<div class="my-card num-${data.room.centerCard.number} ${data.room.centerCard.color}" data-ability data-color="${data.room.centerCard.color}" data-number="${data.room.centerCard.number}"><span class="inner"><span class="mark">${data.room.centerCard.number}</span></span></div>`);
            if (data.room.centerCard.ability === 'plus4') $('.center .center-card').html(`<div class="my-card num-plus4 ${data.room.centerColor}" data-ability="plus4" data-color data-number><span class="inner"><span class="mark">+4</span></span></div>`);
            if (data.room.centerCard.ability === 'plus2') $('.center .center-card').html(`<div class="my-card num-plus2 ${data.room.centerCard.color}" data-ability="plus2" data-color="${data.room.centerCard.color}" data-number><span class="inner"><span class="mark">+2</span></span></div>`);
            if (data.room.centerCard.ability === 'reverse') $('.center .center-card').html(`<div class="my-card num-reverse ${data.room.centerCard.color}" data-ability="reverse" data-color="${data.room.centerCard.color}" data-number><span class="inner"><span class="mark">↩</span></span></div>`);
            if (data.room.centerCard.ability === 'block') $('.center .center-card').html(`<div class="my-card num-block ${data.room.centerCard.color}" data-ability="block" data-color="${data.room.centerCard.color}" data-number><span class="inner"><span class="mark">🚫</span></span></div>`);
            if (data.room.centerCard.ability === 'change') $('.center .center-card').html(`<div class="my-card num-change ${data.room.centerColor}" data-ability="change" data-color data-number><span class="inner"><span class="mark"><div class="change"><div class="segment yellow"></div><div class="segment green"></div><div class="segment blue"></div><div class="segment red"></div></div></span></span></div>`);
            let you = data.room.players.findIndex(player => player.id === user.id);
            $(`.player.you .player-nickname`).html(`<a${data.room.players[you].turn ? ' class="turn"' : ''}>${escapeHtml(data.room.players[you].nickname)}</a>`);
            for (let j = 0, i = you + 1; true; i++) {
                if (you === i || j >= data.room.players.length - 1) break;
                if (i >= data.room.players.length) i = 0;
                j++;
                $(`.player.num-${data.room.players.length}-${j} .my-cards`).html('');
                data.room.players[i].cards.forEach(() => {
                    $(`.player.num-${data.room.players.length}-${j} .my-cards`).append(`<div class="my-card black"><span class="inner"><span class="mark default"><div class="uno-default">UNO</div></span></span></div>`);
                });
                $(`.player.num-${data.room.players.length}-${j} .player-nickname`).html(`<a${data.room.players[i].turn ? ' class="turn"' : ''}>${escapeHtml(data.room.players[i].nickname)}</a>`);
            };
            $('.color-selector-container').hide();
            if (!data.room.reversed) {
                $(".round-2").hide();
                $(".round-1").show();
            } else {
                $(".round-1").hide();
                $(".round-2").show();
            }
            if (!data.room.centerPlus) {
                $(".center-plus").hide();
                $(".center-plus").text(null);
            } else {
                $(".center-plus").text("+" + data.room.centerPlus);
                $(".center-plus").show();
            }
        }
    }
    if (data.type === 'timeout') {
        if (!data.time) return;
        $('.timeout').text(data.time);
        user.countdown = setInterval(() => {
            data.time--;
            $('.timeout').text(data.time);
            if (!data.time) {
                clearInterval(user.countdown);
                $('.timeout').text(null);
            }
        }, 1e3);
    }
    if (data.type === 'start' || data.type === 'round_over') {
        $("#scores").hide();
    }
    if (data.type === 'start') {
        reset();
        $("#limbo").hide();
        $('.cancel').hide();
        $('.admin-buttons').hide();
        $("#overlay").show();
        for (let j = 1; j < data.playerCount; j++) {
            $("#overlay").append(`<div class="player num-${data.playerCount}-${j} opponent">
                    <div class="player-nickname"></div>
                    <div class="my-cards"></div>
                </div>`);
        }
        var i = 0, transition = setInterval(() => {
            i++;
            $("#overlay").css({ opacity: i / 200 });
            if (i >= 200) {
                clearInterval(transition);
                $(".my-cards").css('display', 'flex');
                $(".player").show();
                $(".timeout").show();
                $(".uno").show();
                $(".round-container").show();
            }
        }, 10);
    }
    if (data.type === 'players_update') {
        reset();
        for (let j = 1; j < data.playerCount; j++) {
            $("#overlay").append(`<div class="player num-${data.playerCount}-${j} opponent">
                    <div class="player-nickname"></div>
                    <div class="my-cards"></div>
                </div>`);
            $(".player").show();
        }
    }
    if (data.type === 'uno') {
        if (window.uno_message) {
            clearTimeout(window.uno_message);
            delete window.uno_message;
        }
        $(".uno-message").hide();
        $(".uno-message").text(data.nickname + " didn't press the UNO button! (+2 cards)");
        $(".uno-message").show();
        window.uno_message = setTimeout(()=>{$(".uno-message").hide()}, 4e3);
    }
    if (data.type === 'win') {
        if (!isNaN(data.centerCard.number) && !data.centerCard.ability) $('.center .center-card').html(`<div class="my-card num-${data.centerCard.number} ${data.centerCard.color}" data-ability data-color="${data.centerCard.color}" data-number="${data.centerCard.number}"><span class="inner"><span class="mark">${data.centerCard.number}</span></span></div>`);
        if (data.centerCard.ability === 'plus4') $('.center .center-card').html(`<div class="my-card num-plus4 ${data.centerColor}" data-ability="plus4" data-color data-number><span class="inner"><span class="mark">+4</span></span></div>`);
        if (data.centerCard.ability === 'plus2') $('.center .center-card').html(`<div class="my-card num-plus2 ${data.centerCard.color}" data-ability="plus2" data-color="${data.centerCard.color}" data-number><span class="inner"><span class="mark">+2</span></span></div>`);
        if (data.centerCard.ability === 'reverse') $('.center .center-card').html(`<div class="my-card num-reverse ${data.centerCard.color}" data-ability="reverse" data-color="${data.centerCard.color}" data-number><span class="inner"><span class="mark">↩</span></span></div>`);
        if (data.centerCard.ability === 'block') $('.center .center-card').html(`<div class="my-card num-block ${data.centerCard.color}" data-ability="block" data-color="${data.centerCard.color}" data-number><span class="inner"><span class="mark">🚫</span></span></div>`);
        if (data.centerCard.ability === 'change') $('.center .center-card').html(`<div class="my-card num-change ${data.centerColor}" data-ability="change" data-color data-number><span class="inner"><span class="mark"><div class="change"><div class="segment yellow"></div><div class="segment green"></div><div class="segment blue"></div><div class="segment red"></div></div></span></span></div>`);

        $(".scores-list").html('');
        JSON.parse(JSON.stringify(data.players)).sort((a, b) => b.points - a.points).forEach(player => {
            $(".scores-list").append(`<div class="score"><div>${escapeHtml(player.nickname)}</div><div${player.isWinner ? ' style="color:#00ff00;"' : ''}>${player.isWinner ? '+' : ''}${player.points}/${data.max_points}</div></div>`);
        });
        $(".center-plus").hide();
        $(".center-plus").text(null);
        $("#scores").show();

        if (user.countdown) clearInterval(user.countdown);
        $('.timeout').text(null);

        let you = data.players.findIndex(player => player.id === user.id);
        for (let j = 0, i = you + 1; true; i++) {
            if (you === i || j >= data.players.length - 1) break;
            if (i >= data.players.length) i = 0;
            j++;
            $(`.player.num-${data.players.length}-${j} .my-cards`).html('');
            data.players[i].cards.forEach(card => {
                if (!isNaN(card.number) && !card.ability) return $(`.player.num-${data.players.length}-${j} .my-cards`).append(`<div class="my-card num-${card.number} ${card.color}" data-ability data-color="${card.color}" data-number=${card.number}><span class="inner"><span class="mark">${card.number}</span></span></div>`);
                if (card.ability === 'plus4') return $(`.player.num-${data.players.length}-${j} .my-cards`).append(`<div class="my-card num-plus4 black" data-ability="plus4" data-color data-number><span class="inner"><span class="mark">+4</span></span></div>`);
                if (card.ability === 'plus2') return $(`.player.num-${data.players.length}-${j} .my-cards`).append(`<div class="my-card num-plus2 ${card.color}" data-ability="plus2" data-color="${card.color}" data-number><span class="inner"><span class="mark">+2</span></span></div>`);
                if (card.ability === 'reverse') return $(`.player.num-${data.players.length}-${j} .my-cards`).append(`<div class="my-card num-reverse ${card.color}" data-ability="reverse" data-color="${card.color}" data-number><span class="inner"><span class="mark">↩</span></span></div>`);
                if (card.ability === 'block') return $(`.player.num-${data.players.length}-${j} .my-cards`).append(`<div class="my-card num-block ${card.color}" data-ability="block" data-color="${card.color}" data-number><span class="inner"><span class="mark">🚫</span></span></div>`);
                if (card.ability === 'change') return $(`.player.num-${data.players.length}-${j} .my-cards`).append(`<div class="my-card num-change black" data-ability="change" data-color data-number><span class="inner"><span class="mark"><div class="change"><div class="segment yellow"></div><div class="segment green"></div><div class="segment blue"></div><div class="segment red"></div></div></span></span></div>`);
            })
        }
    }
    if (data.type === 'kicked' || data.type === 'room_closed') {
        location.hash = '';
        $("#overlay").hide();
        $("#overlay").css('opacity', '0');
        $("#limbo").hide();
        $("#nickname").hide();
        $("#games-container").show();
        $(".timeout").hide();
        $(".round-container").hide();
        $("#scores").hide();
        $(".uno").hide();
        $(".my-cards").hide();
    }
    if (data.type === 'error') {
        error(data.title, data.message);
    }
    if (data.type === 'room_closed') {
        error("Room Closed", data.message);
    }
    if (data.type === 'winner') {
        if (user.action === 'create') $('.admin-buttons').show();
    }
    if (data.type === 'chat_message') {
        $('.chat-messages').append(`<div class="chat-item">
                        <div class="sender" style="color:${data.color}">${escapeHtml(data.nickname)}:</div>
                        <div class="message">${escapeHtml(data.message)}</div>
                    </div>`);
    }
};

function error(title, description) {
    $('.error-head .error-title a').text(title);
    $('.error-head .error-desc').text(description);
    $('.error-close').show();
    $('#error-container').show();
    location.hash = '';
}

function reset() {
    $(".player.opponent").remove();
}

$('#play').click(() => {
    $("#menu-screen").hide();
    $("#games-container").show();
    server.send(JSON.stringify({ type: 'room_list' }));
});
$('.refresh').click(() => {
    server.send(JSON.stringify({ type: 'room_list' }));
});
$('.create-room').click(() => {
    $("#games-container").hide();
    $('#nickname').show();
    $('.cancel').show();
    $(".nickname").focus();
    $('.cancel').show();
    $('.room-settings').show();
    user.action = 'create';
});
$('.join-room').click(() => {
    room.roomID = $('input.room-code').val();
    server.send(JSON.stringify({ type: "room_check", roomID: room.roomID }));
});
$('.continue').click(() => {
    $('input.room-code').val(null);
    if (!user.action) return;
    if (user.action === 'create') {
        server.send(JSON.stringify({ type: 'create', nickname: $('input.nickname').val(), private: $('[data-private]').is(":checked") }));
    };
    if (user.action === 'join') {
        server.send(JSON.stringify({ type: 'join', nickname: $('input.nickname').val(), roomID: room.roomID }));
    }
});
$('.cancel').click(() => {
    $('#nickname').hide();
    $('.cancel').hide();
    $("#limbo").hide();
    $("#games-container").show();
    if (user.isConnected) server.send(JSON.stringify({ type: 'leave_room' }));
    user.isConnected = false;
})
$('.limbo-start').click(() => {
    server.send(JSON.stringify({ type: 'start' }));
});
$('.scores-start').click(() => {
    server.send(JSON.stringify({ type: 'start' }));
});
$('.deck .my-card').click(() => {
    server.send(JSON.stringify({ type: 'action', action: 'take' }));
});
$('.chat-head').click(() => {
    if($('.chat').css('height') === '0px') {
        $('.chat').css('height', '');
        $('.chat-switch i').css('transform', '');
        localStorage.setItem('chat_open', true);
    } else {
        $('.chat').css('height', '0px');
        $('.chat-switch i').css('transform','rotate(180deg)');
        localStorage.setItem('chat_open', false);
    }
});
$('.chat-send').click(() => {
    server.send(JSON.stringify({ type: "message", message: $('.chat-input input').val() }));
    $('.chat-input input').val('');
})
$(window).keydown(key => {
    if ((key.keyCode === 13 || key.key === 'Enter') && $('.chat').css('height') !== '0px' && $("#overlay").css('display') === 'block'){
        if ($('.chat-input input').is(":focus")) {
            server.send(JSON.stringify({ type: "message", message: $('.chat-input input').val() }));
            $('.chat-input input').val('');
        } else $('.chat-input input').focus();
    }
    //if(key.keyCod)
})
$('.uno').click(()=>{
    server.send(JSON.stringify({type: 'uno'}));
})
$('.color-selector .green').click(() => {
    user.push.pickedColor = 'green';
    server.send(JSON.stringify({ type: 'action', card: user.push, action: 'place' }));
    $(".color-selector-container").hide();
});
$('.color-selector .blue').click(() => {
    user.push.pickedColor = 'blue';
    server.send(JSON.stringify({ type: 'action', card: user.push, action: 'place' }));
    $(".color-selector-container").hide();
});
$('.color-selector .yellow').click(() => {
    user.push.pickedColor = 'yellow';
    server.send(JSON.stringify({ type: 'action', card: user.push, action: 'place' }));
    $(".color-selector-container").hide();
});
$('.color-selector .red').click(() => {
    user.push.pickedColor = 'red';
    server.send(JSON.stringify({ type: 'action', card: user.push, action: 'place' }));
    $(".color-selector-container").hide();
});
$('.color-selector-container').click(() => {
    $('.color-selector-container').hide();
});
$('.error-close').click(() => {
    $('#error-container').hide();
})

window.onbeforeunload = () => {
    localStorage.setItem("nick", $('input.nickname').val());
};
if (localStorage.getItem("nick")) $('input.nickname').val(localStorage.getItem("nick"));
if (localStorage.getItem("chat_open") !== "true") {
    $('.chat').css('height', '0px');
    $('.chat-switch i').css('transform', 'rotate(180deg)');
}

var escapeHtml = message => message.replace(/[\"&<>]/g, off => {
    return {
        '"': "&quot;",
        "'": "&#39;",
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;"
    }[off];
})