const fetch = require('node-fetch');
const request = require("request");
const axios = require('axios');
const config = require('../config/config.json');
const fs = require('fs');
const schedule = require('node-schedule');
const mysql = require('mysql2/promise');
const dt = require('date-and-time');
const postHeader = {
    headers: {
        Authorization: `Bearer ${config.Mattermost_Bot_Personal_Token}`
    },
}
const makeAction = (name, path, content) => {
    if (content === undefined) content = null;
    return {
        name: name,
        integration: {
            url: `${config.Server_URL}/${path}`,
            context: content
        }
    };
}

const pool = mysql.createPool({
    host: `${config.DB_Host}`,
    port: `${config.DB_Port}`,
    user: `${config.DB_User}`,
    password: `${config.DB_Password}`,
    database: `${config.DB_Database}`
});

let addedUserName;
let attachments;
let message;
let userList = [];
let actions = [
    makeAction("새로운 Item 만들기", 'create'),
    makeAction("기존 Item에 내용 추가하기", 'modify'),
];

module.exports = (app) => {
    app.post('/dailyjournal', async (req, res) => {
        let date = new Date();
        let reqOption = req.body.text;
        let tempString = reqOption.substring(0, 7);
        if (tempString.indexOf('user') >= 0) {
            addedUserName = reqOption.replace(/user /gi, "");
            reqOption = 'user';
        }
        if (tempString.indexOf('admin') >= 0) {
            addedUserName = reqOption.replace(/admin /gi, "");
            reqOption = 'admin';
        }
        if (tempString.indexOf('manager') >= 0) {
            addedUserName = reqOption.replace(/manager /gi, "");
            reqOption = 'manager';
        }
        if (tempString.indexOf('remove') >= 0) {
            addedUserName = reqOption.replace(/remove /gi, "");
            reqOption = 'remove';
        }
        if (tempString.indexOf('adddata') >= 0) {
            addedUserName = reqOption.replace(/adddata /gi, "");
            reqOption = 'adddata';
        }
        switch (reqOption) {
            case "":
                let tempMonth = date.getMonth() + 1;
                let tempDate = date.getDate();
                if (1 >= tempMonth.toString().length) {
                    tempMonth = `0${tempMonth}`;
                }
                if (1 >= tempDate.toString().length) {
                    tempDate = `0${tempDate}`;
                }
                try {
                    let connection = await pool.getConnection(async conn => conn);
                    try {
                        let [checkLastItemID] = await connection.query(`SELECT LastItemID, LastModify FROM dataInfo WHERE ID = '${req.body.user_name}';`);
                        connection.destroy();
                        if (checkLastItemID[0]) {
                            actions = [
                                makeAction("새로운 Item 만들기", 'create'),
                                makeAction("기존 Item에 내용 추가하기", 'modify'),
                            ];
                            attachments = [{
                                "title": "업무일지 작성",
                                "text": `최종 생성 Item : [${checkLastItemID[0].LastItemID}](${config.CodeBeamer_Tracker_Item_URL}${checkLastItemID[0].LastItemID}) / 최종 수정 : ${checkLastItemID[0].LastModify} / 오늘 날짜 : ${date.getFullYear()}-${tempMonth}-${tempDate}`,
                                "fields": [],
                                "actions": actions
                            }];
                            res.send({ username: "Daily Journal Bot", response_type: 'in_channel', attachments });
                            break;
                        } else {
                            actions = [
                                makeAction("새로운 Item 만들기", 'create')
                            ];
                            attachments = [{
                                "title": "업무일지 작성",
                                "text": `마지막으로 생성된 Item이 없습니다. Item을 생성해주세요. / 오늘 날짜 : ${date.getFullYear()}-${tempMonth}-${tempDate}`,
                                "fields": [],
                                "actions": actions
                            }];
                            res.send({ username: "Daily Journal Bot", response_type: 'in_channel', attachments });
                            break;
                        }
                    } catch (error) {
                        res.send({
                            text: `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`,
                            response_type: "ephemeral",
                            username: "Daily Journal Bot"
                        });
                        connection.destroy();
                        break;
                    }
                } catch (error) {
                    res.send({
                        text: `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`,
                        response_type: "ephemeral",
                        username: "Daily Journal Bot"
                    });
                    break;
                }

                case "time":
                    const nowTime = await getUserTime(req.body.user_name);
                    actions = [
                        makeAction("취소", 'cancel'),
                        makeAction("변경", 'time_set'),
                    ];
                    attachments = [{
                        "title": "Notice 시간 변경",
                        "text" : `현재 notice 시간 : ${nowTime}`,
                        "fields": [],
                        "actions": actions
                    }];
                    res.send({ username: "Daily Journal Bot", response_type: 'in_channel', attachments });
                    break;

            case "version":
                res.send({
                    text: `Daily Journal Bot Version ${config.VERSION}`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            case "role":
                const tempRole = await getUserRole(req.body.user_name);
                res.send({
                    text: `User ${req.body.user_name}의 Role은 **${tempRole}**입니다.`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            case "list":
                const tempUserRole = await getUserRole(req.body.user_name);
                if (tempUserRole == 'admin' || tempUserRole == 'manager') {
                    await databaseList();
                    res.send({
                        text: `${userList.join('')}`,
                        response_type: "ephemeral",
                        username: "Daily Journal Bot"
                    });
                    break;
                }
                res.send({
                    text: `현재 User Role : ${tempUserRole}\nDaily Journal Bot Admin/Manager만 해당 명령어를 사용 가능합니다.`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            case "remove":
                const tempRemoveUserRole = await getUserRole(req.body.user_name);
                if (tempRemoveUserRole == 'admin' || tempRemoveUserRole == 'manager') {
                    if (addedUserName != 'remove') {
                        actions = [
                            makeAction("취소", 'cancel'),
                            makeAction("제거", 'remove_user'),
                        ];
                        attachments = [{
                            "title": "User 제거",
                            "text": `정말로 제거하시겠습니까?`,
                            "fields": [],
                            "actions": actions
                        }];
                        res.send({ username: "Daily Journal Bot", response_type: 'in_channel', attachments });
                        break;
                    } else {
                        res.send({
                            text: `추가된 User가 없습니다.`,
                            response_type: "ephemeral",
                            username: "Daily Journal Bot"
                        });
                        break;
                    }
                }
                res.send({
                    text: `현재 User Role : ${tempUserRole}\nDaily Journal Bot Admin/Manager만 해당 명령어를 사용 가능합니다.`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            case "admin":
                const tempAdminUserRole = await getUserRole(req.body.user_name);
                if (tempAdminUserRole == 'admin' || tempAdminUserRole == 'manager') {
                    await updateUserRole(addedUserName, reqOption);
                    res.send({
                        text: `${message}`,
                        response_type: "ephemeral",
                        username: "Daily Journal Bot"
                    });
                    break;
                }
                res.send({
                    text: `현재 User Role : ${tempUserRole}\nDaily Journal Bot Admin/Manager만 해당 명령어를 사용 가능합니다.`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            case "user":
                const tempSetUserRole = await getUserRole(req.body.user_name);
                if (tempSetUserRole == 'admin' || tempSetUserRole == 'manager') {
                    await updateUserRole(addedUserName, reqOption);
                    res.send({
                        text: `${message}`,
                        response_type: "ephemeral",
                        username: "Daily Journal Bot"
                    });
                    break;
                }
                res.send({
                    text: `현재 User Role : ${tempUserRole}\nDaily Journal Bot Admin/Manager만 해당 명령어를 사용 가능합니다.`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            case "manager":
                const tempManagerRole = await getUserRole(req.body.user_name);
                if (tempManagerRole == 'admin' || tempManagerRole == 'manager') {
                    await updateUserRole(addedUserName, reqOption);
                    res.send({
                        text: `${message}`,
                        response_type: "ephemeral",
                        username: "Daily Journal Bot"
                    });
                    break;
                }
                res.send({
                    text: `현재 User Role : ${tempUserRole}\nDaily Journal Bot Admin/Manager만 해당 명령어를 사용 가능합니다.`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            case "timetest":
                const tempUserHomeTimeAB = await getUserHomeTime(req.body.user_name);
                let timeToNotice;
                if(tempUserHomeTimeAB == 'A'){
                    timeToNotice = '오후 5시 30분'
                } else {
                    timeToNotice = '오후 6시'
                }
                actions = [
                    makeAction("5시 30분", 'fivethirty'),
                    makeAction("6시", 'six'),
                    makeAction("취소", "cancel2")
                ];
                attachments = [{
                    "title": "알림 받을 시간 선택",
                    "text": `Daily Journal Bot에게 업무일지 알림을 받을 시간을 선택해 주세요.\n현재 알림이 오는 시간 : ${timeToNotice}`,
                    "fields": [],
                    "actions": actions
                }];
                res.send({ username: "Daily Journal Bot", response_type: 'in_channel', attachments });
                break;

            case "adddata":
                await addUser(addedUserName);
                res.send({
                    text: `${message}`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;

            default:
                res.send({
                    text: `명령어가 잘못 입력되었습니다. 명령어를 다시 확인해주세요.`,
                    response_type: "ephemeral",
                    username: "Daily Journal Bot"
                });
                break;
        }

        app.post('/user_time_set', async (req, res) => {
            userTimeSet(req.body.user_id, req.body.submission.text_username, req.body.submission.text_hours, req.body.submission.text_minutes);
            res.send({ update: { props: { attachments } } });
        });

        app.post('/six', async (req, res) => {
            await setUserTime(req.body.user_name, 'B');
            const attachments = [{
                "title": "알림 시간을 6시로 설정하였습니다."
            }];
            res.send({ update: { props: { attachments } } });
        });

        app.post('/fivethirty', async (req, res) => {
            await setUserTime(req.body.user_name, 'A');
            const attachments = [{
                "title": "알림 시간을 5시 30분으로 설정하였습니다."
            }];
            res.send({ update: { props: { attachments } } });
        });

        app.post('/cancel', (req, res) => {
            const attachments = [{
                "title": "User 제거를 취소하였습니다."
            }];
            res.send({ update: { props: { attachments } } });
        });

        app.post('/cancel2', (req, res) => {
            const attachments = [{
                "title": "수정을 취소하였습니다."
            }];
            res.send({ update: { props: { attachments } } });
        });

        app.post('/cancel3', (req, res) => {
            const attachments = [{
                "title": "생성을 취소하였습니다."
            }];
            res.send({ update: { props: { attachments } } });
        });

        app.post('/remove_user', async (req, res) => {
            try {
                let connection = await pool.getConnection(async conn => conn);
                try {
                    let [userYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${addedUserName}') AS SUCCESS;`);
                    connection.destroy();
                    if (userYesNo[0].SUCCESS == '0') {
                        const attachments = [{
                            "title": `해당 User **${addedUserName}**이(가) 존재하지 않습니다.`
                        }];
                        res.send({ update: { props: { attachments } } });
                    } else {
                        await removeUser(addedUserName);
                        const attachments = [{
                            "title": `해당 User **${addedUserName}**이(가) 제거되었습니다.`
                        }];
                        res.send({ update: { props: { attachments } } });
                    }
                } catch (error) {
                    message = `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
                    connection.destroy();
                }
            } catch (error) {
                message = `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
            }
        });

        app.post('/create', async (req, res) => {
            let itemMonth = await getItemMonth(req.body.user_name);
            if (itemMonth == 'QueryError' || itemMonth == 'DBError') {
                const attachments = [{
                    "title": `${itemMonth}. 관리자에게 문의하세요.`
                }];
                res.send({ update: { props: { attachments } } });
            } else {
                let date = new Date();
                let tempMonth = date.getMonth() + 1;
                if (1 >= tempMonth.toString().length) {
                    tempMonth = `0${tempMonth}`;
                }
                if (itemMonth == '0') {
                    dialogNew(req.body.trigger_id, req.body.user_name);
                    const attachments = [{
                        "title": `생성중입니다.\n완료되면 해당Bot에게 DM을 받습니다.`
                    }];
                    res.send({ update: { props: { attachments } } });
                } else {
                    if (itemMonth == tempMonth) {
                        actions = [
                            makeAction("취소", 'cancel3'),
                            makeAction("생성", 'creat2'),
                        ];
                        attachments = [{
                            "title": "새로운 Item 생성",
                            "text": `**이번 달(${tempMonth}월)**과 **마지막으로 생성한 Item의 달(${itemMonth}월)**이 같습니다.\n그래도 생성하시겠습니까?`,
                            "fields": [],
                            "actions": actions
                        }];
                        res.send({ update: { props: { attachments } } });
                    } else {
                        dialogNew(req.body.trigger_id, req.body.user_name);
                        const attachments = [{
                            "title": `생성중입니다.\n완료되면 해당Bot에게 DM을 받습니다.`
                        }];
                        res.send({ update: { props: { attachments } } });
                    }
                }
            }
        });

        app.post('/modify', async (req, res) => {
            let itemMonth = await getItemMonth(req.body.user_name);
            if (itemMonth == 'QueryError' || itemMonth == 'DBError') {
                const attachments = [{
                    "title": `${itemMonth}. 관리자에게 문의하세요.`
                }];
                res.send({ update: { props: { attachments } } });
            } else {
                let date = new Date();
                let tempMonth = date.getMonth() + 1;
                if (1 >= tempMonth.toString().length) {
                    tempMonth = `0${tempMonth}`;
                }
                if (itemMonth != tempMonth) {
                    actions = [
                        makeAction("취소", 'cancel2'),
                        makeAction("수정", 'modify2'),
                    ];
                    attachments = [{
                        "title": "기존 Item 수정",
                        "text": `**이번 달(${tempMonth}월)**과 **마지막으로 생성한 Item의 달(${itemMonth}월)**이 다릅니다.\n그래도 수정하시겠습니까?`,
                        "fields": [],
                        "actions": actions
                    }];
                    res.send({ update: { props: { attachments } } });
                } else {
                    dialogModify(req.body.trigger_id, req.body.user_name);
                    const attachments = [{
                        "title": `내용 추가 중입니다.\n내용 추가가 완료되면 해당 Bot에게 DM을 받습니다.`
                    }];
                    res.send({ update: { props: { attachments } } });
                }
            }
        });
    });

    app.post('/time_set', async (req, res) => {
        dialogTimeSet(req.body.trigger_id, req.body.user_name);
        const attachments = [{
            "title": `업데이트중입니다.\n완료되면 해당Bot에게 DM을 받습니다.`
        }];
        res.send({ update: { props: { attachments } } });
    });

    app.post('/creat2', async (req, res) => {
        dialogNew(req.body.trigger_id, req.body.user_name);
        const attachments = [{
            "title": `생성중입니다.\n완료되면 해당Bot에게 DM을 받습니다.`
        }];
        res.send({ update: { props: { attachments } } });
    });

    app.post('/modify2', async (req, res) => {
        dialogModify(req.body.trigger_id, req.body.user_name);
        const attachments = [{
            "title": `내용 추가 중입니다.\n내용 추가가 완료되면 해당 Bot에게 DM을 받습니다.`
        }];
        res.send({ update: { props: { attachments } } });
    });

    app.post('/submit_create', async (req, res) => {
        let date = new Date();
        let lastDay = (new Date(date.getFullYear(), date.getMonth() + 1, 0)).getDate();
        res.send();
        let tempMonth = date.getMonth() + 1;
        let tempDate = date.getDate();
        if (1 >= tempMonth.toString().length) {
            tempMonth = `0${tempMonth}`;
        }
        if (1 >= tempDate.toString().length) {
            tempDate = `0${tempDate}`;
        }
        let week = ['일', '월', '화', '수', '목', '금', '토'];
        let dayOfWeek = week[new Date(`${req.body.submission.textprops_date}`).getDay()];
        axios({
            method: 'GET',
            url: `${config.Modify_REST_URL}/users/page/1?pagesize=500&filter=${req.body.submission.textprops}@slexn.com`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${config.CB_Authorization}`,
                'Accept-Language': 'ko/KR'
            },
        }).then(async (data) => {
            let itemData = {
                "name": `${data.data.users[0].name}(${date.getFullYear()}.${tempMonth})`,
                "tracker": `${config.CodeBeamer_Tracker}`,
                "시작일": `${date.getFullYear()}-${tempMonth}-${tempDate}`,
                "종료일": `${date.getFullYear()}-${tempMonth}-${lastDay}`,
                "supervisors": `/user/${data.data.users[0].name}`,
                "description": `${req.body.submission.textprops_date.replace(/"/g, '')}(${dayOfWeek})\n${req.body.submission.textareaprops.replace(/"/g, '')}`
            };
            axios({
                method: 'POST',
                url: `${config.Modify_REST_URL}/item`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${config.CB_Authorization}`,
                    'Accept-Language': 'ko/KR'
                },
                data: itemData
            }).then(async (res) => {
                try {
                    let connection = await pool.getConnection(async conn => conn);
                    try {
                        let [userYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${req.body.submission.textprops}') AS SUCCESS;`);
                        connection.release();
                        if (userYesNo[0].SUCCESS == '0') {
                            try {
                                let [results] = await connection.query(`INSERT INTO dataInfo(ROLE, ID, LastItemID, LastModify, LastCreate, userID, month, userTime)VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [`user`, `${req.body.submission.textprops}`, `${res.data.uri}`, `${date.getFullYear()}-${tempMonth}-${tempDate}`, `${date.getFullYear()}-${tempMonth}-${tempDate}`, `${req.body.user_id}`, `${tempMonth}`, '17:30']);
                                connection.destroy();
                                sendDM(req.body.user_id, `${req.body.submission.textprops}(${date.getFullYear()}.${tempMonth}) Item을 생성하였습니다.\n[Item 확인하기](${config.CodeBeamer_Tracker_Item_URL}${res.data.uri}) | [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                            } catch (error) {
                                sendDM(req.body.user_id, `Item 생성에 실패하였습니다. Query에 문제가 발생했습니다. 관리자에게 문의하시길 바랍니다.\n${error}`);
                            }
                        } else {
                            try {
                                let [results] = await connection.query(`UPDATE dataInfo SET LastItemID = '${res.data.uri}', LastModify = '${date.getFullYear()}-${tempMonth}-${tempDate}', LastCreate = '${date.getFullYear()}-${tempMonth}-${tempDate}', month = '${tempMonth}' WHERE ID = '${req.body.submission.textprops}'`);
                                connection.destroy();
                                sendDM(req.body.user_id, `${req.body.submission.textprops}(${date.getFullYear()}.${tempMonth}) Item을 생성하였습니다.\n[Item 확인하기](${config.CodeBeamer_Tracker_Item_URL}${res.data.uri}) | [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                            } catch (error) {
                                sendDM(req.body.user_id, `Item 생성에 실패하였습니다. Query에 문제가 발생했습니다. 관리자에게 문의하시길 바랍니다.\n${error}`);
                            }
                        }
                    } catch (error) {
                        sendDM(req.body.user_id, `Item 생성에 실패하였습니다. Query에 문제가 발생했습니다. 관리자에게 문의하시길 바랍니다.\n${error}`);
                        connection.destroy();
                    }
                } catch (error) {
                    sendDM(req.body.user_id, `Item 생성에 실패하였습니다. Database에 문제가 발생했습니다. 관리자에게 문의하시길 바랍니다.\n${error}`);
                }
            }).catch((error) => {
                sendDM(req.body.user_id, `codeBeamer API 에러가 발생하였습니다.\n관리자에게 문의하시길 바랍니다.\n${error}`);
            })
        });
    });

    app.post('/submit_modify', async (req, res) => {
        res.send();
        let itemUri = null;
        let itemName = null;
        let itemDescription = null;
        let itemDescriptionAfter = null;
        let sumItemDescription = null;
        let jullbakum = '\n';
        let date = new Date();
        let tempMonth = date.getMonth() + 1;
        let tempDate = date.getDate();
        if (1 >= tempMonth.toString().length) {
            tempMonth = `0${tempMonth}`;
        }
        if (1 >= tempDate.toString().length) {
            tempDate = `0${tempDate}`;
        }
        let week = ['일', '월', '화', '수', '목', '금', '토'];
        let dayOfWeek = week[new Date(`${req.body.submission.textprops_date}`).getDay()];
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [results] = await connection.query(`SELECT LastItemID FROM dataInfo WHERE ID = '${req.body.submission.textprops}';`);
                connection.release();
                try {
                    axios({
                        method: 'get',
                        url: `${config.Modify_REST_URL}${results[0].LastItemID}/edit`,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Basic ${config.CB_Authorization}`
                        }
                    }).then((res) => {
                        itemUri = res.data.item.uri;
                        itemName = res.data.item.name;
                        itemDescription = JSON.stringify(res.data.item.description);
                        itemDescriptionAfter = itemDescription.slice(0, -1);
                        sumItemDescription = `{ "uri": "${itemUri}", "description": ${itemDescriptionAfter} ${JSON.stringify(jullbakum).replace(/"/g, '')} ${JSON.stringify(jullbakum).replace(/"/g, '')} ${JSON.stringify(req.body.submission.textprops_date.replace(/"/g, '')).replace(/"/g, '')}(${dayOfWeek}) ${JSON.stringify(jullbakum).replace(/"/g, '')} ${JSON.stringify(req.body.submission.textareaprops.replace(/"/g, '')).replace(/"/g, '')}"}`;
                        axios({
                            method: 'PUT',
                            url: `${config.Modify_REST_URL}/item`,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Basic ${config.CB_Authorization}`,
                                'Accept-Language': 'ko/KR'
                            },
                            data: sumItemDescription
                        }).then(async (res) => {
                            if (res.status == 200) {
                                try {
                                    let [results] = await connection.query(`UPDATE dataInfo SET LastModify = '${date.getFullYear()}-${tempMonth}-${tempDate}', month = '${itemName.substring(itemName.length - 3, itemName.length - 1)}' WHERE ID = '${req.body.submission.textprops}'`);
                                    connection.destroy();
                                    sendDM(req.body.user_id, `${itemName} Item에 내용추가를 완료했습니다.\n[Item 확인하기](${config.CodeBeamer_Tracker_Item_URL}${itemUri}) | [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                                } catch (error) {
                                    sendDM(req.body.user_id, `수정에 성공했으나 관련 정보를 Database에 Update하지 못 했습니다.\n관리자에게 문의하시길 바랍니다.`);
                                }
                            } else {
                                sendDM(req.body.user_id, `수정에 실패했습니다.\n관리자에게 문의하시길 바랍니다.`);
                            }
                        }, (error) => {
                            console.log(error);
                            sendDM(req.body.user_id, `수정에 실패했습니다.\nItem이 삭제되었을 수도 있습니다.\n관리자에게 문의하시길 바랍니다.`);
                        })
                    }).catch((error) => {
                        console.log(error);
                        sendDM(req.body.user_id, `수정에 실패했습니다.\nItem이 삭제되었을 수도 있습니다.\n관리자에게 문의하시길 바랍니다.`);
                    })
                } catch (error) {
                    console.log(error);
                    sendDM(req.body.user_id, `수정에 실패했습니다.\nItem이 삭제되었을 수도 있습니다.\n관리자에게 문의하시길 바랍니다.`);
                }
            } catch (error) {
                sendDM(req.body.user_id, `쿼리에서 에러가 발생하였습니다.\n관리자에게 문의하시길 바랍니다.`);
                connection.destroy();
            }
        } catch (error) {
            sendDM(req.body.user_id, `Database 에러가 발생하였습니다.\n관리자에게 문의하시길 바랍니다.`);
        }
    });

    const sendDM = (userId, message) => {
        let dmPost;
        dmPost = [
            `${userId}`,
            `${config.Bot_User_Id}`
        ]
        axios.post(config.Direct_URL, dmPost, postHeader)
            .then((res) => {
                dmPost = {
                    channel_id: `${res.data.id}`,
                    message: `${message}`
                }
                axios.post(config.Finger_Chat_API_URL, dmPost, postHeader
                ).catch(error => {
                    console.log(error);
                });
            })
            .catch(error => {
                console.log(error);
            });
    }

    const dialogTimeSet = async (id, username) => {
        let dialogNewPost;
        dialogNewPost = {
            trigger_id: id,
            url: `${config.Server_URL}/user_time_set`,
            dialog: {
                title: 'Notice 시간 변경하기',
                elements: [
                    {
                        display_name: '변경자(절대 수정하지 마세요.)',
                        name: 'text_username',
                        type: 'text',
                        default: `${username}`,
                        optional: false,
                    },
                    {
                        display_name: '시(00~23)',
                        name: 'text_hours',
                        type: 'text',
                        min_length : 2,
                        max_length : 2,
                        default: `17`,
                        help_text: '시간을 입력해주세요. 시간은 00시부터 23시까지 입력 가능합니다.',
                        optional: false,
                    },
                    {
                        display_name: '분(00~59)',
                        name: 'text_minutes',
                        type: 'text',
                        min_length : 2,
                        max_length : 2,
                        default: `30`,
                        help_text: '분을 입력해주세요. 분은 00분부터 59분까지 입력 가능합니다.',
                        optional: false,
                    },
                ],
                submit_label: '시간 변경',
                notify_on_cancel: false,
            }
        }
        axios.post(config.Finger_Chat_API_URL2, dialogNewPost, postHeader
        ).catch(error => {
            sendDM(config.FingerChat_Error_Notice_Member_ID, `API 에러가 발생하였습니다.\n${error}`);
        });
    }

    const dialogNew = async (id, username) => {
        let date = new Date();
        let tempMonth = date.getMonth() + 1;
        let tempDate = date.getDate();
        if (1 >= tempMonth.toString().length) {
            tempMonth = `0${tempMonth}`;
        }
        if (1 >= tempDate.toString().length) {
            tempDate = `0${tempDate}`;
        }
        let dialogNewPost;
        dialogNewPost = {
            trigger_id: id,
            url: `${config.Server_URL}/submit_create`,
            dialog: {
                title: '새로운 Item 생성',
                elements: [
                    {
                        display_name: '작성자(절대 수정하지 마세요.)',
                        name: 'textprops',
                        type: 'text',
                        default: `${username}`,
                        optional: false,
                    },
                    {
                        display_name: '날짜',
                        name: 'textprops_date',
                        type: 'text',
                        default: `${date.getFullYear()}-${tempMonth}-${tempDate}`,
                        help_text: '날짜를 입력해주세요. Default값은 오늘입니다.',
                        optional: false,
                    },
                    {
                        display_name: '업무 내용',
                        name: 'textareaprops',
                        type: 'textarea',
                        default: `- `,
                        help_text: '업무 내용을 입력해주세요.',
                        optional: false,
                    },
                ],
                submit_label: 'Item 생성하기',
                notify_on_cancel: false,
            }
        }
        axios.post(config.Finger_Chat_API_URL2, dialogNewPost, postHeader
        ).catch(error => {
            sendDM(config.FingerChat_Error_Notice_Member_ID, `API 에러가 발생하였습니다.\n${error}`);
        });
    }


    const dialogModify = async (id, username) => {
        let date = new Date();
        let tempMonth = date.getMonth() + 1;
        let tempDate = date.getDate();
        if (1 >= tempMonth.toString().length) {
            tempMonth = `0${tempMonth}`;
        }
        if (1 >= tempDate.toString().length) {
            tempDate = `0${tempDate}`;
        }
        let dialogModifyPost;
        dialogModifyPost = {
            trigger_id: id,
            url: `${config.Server_URL}/submit_modify`,
            dialog: {
                title: '기존 Item 수정',
                elements: [
                    {
                        display_name: '작성자(절대 수정하지 마세요.)',
                        name: 'textprops',
                        type: 'text',
                        default: `${username}`,
                        optional: false,
                    },
                    {
                        display_name: '날짜',
                        name: 'textprops_date',
                        type: 'text',
                        default: `${date.getFullYear()}-${tempMonth}-${tempDate}`,
                        help_text: '날짜를 입력해주세요. Default값은 오늘입니다.',
                        optional: false,
                    },
                    {
                        display_name: '업무 내용',
                        name: 'textareaprops',
                        type: 'textarea',
                        help_text: '날짜와 업무 내용을 입력해주세요.',
                        default: `- `,
                        optional: false,
                    },
                ],
                submit_label: 'Item에 내용 추가하기',
                notify_on_cancel: false,
            }
        }
        axios.post(config.Finger_Chat_API_URL2, dialogModifyPost, postHeader
        ).catch(error => {
            sendDM(config.FingerChat_Error_Notice_Member_ID, `API 에러가 발생하였습니다.\n${error}`);
        });
    }

    const addUser = async (addedUserName) => {
        let date = new Date();
        let tempMonth = date.getMonth() + 1;
        let tempDate = date.getDate();
        if (1 >= tempMonth.toString().length) {
            tempMonth = `0${tempMonth}`;
        }
        if (1 >= tempDate.toString().length) {
            tempDate = `0${tempDate}`;
        }
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [results] = await connection.query(`INSERT INTO dataInfo(ROLE, ID, LastItemID, LastModify, LastCreate, userID, month, userTime)VALUES('user', '${addedUserName}', null, '${date.getFullYear()}-${tempMonth}-${tempDate}', '${date.getFullYear()}-${tempMonth}-${tempDate}', null, 4, 'A');`);
                message = `해당 User를 추가했습니다.`;
                connection.destroy();
            } catch (error) {
                message = `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
                connection.destroy();
            }
        } catch (error) {
            message = `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
        }
    }

    const setUserTime = async (userName, userType) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [results] = await connection.query(`UPDATE dataInfo SET userTime = '${userType}' WHERE ID = '${userName}'`);
                connection.destroy();
            } catch (error) {
                connection.destroy();
            }
        } catch (error) {
            sendDM(config.FingerChat_Error_Notice_Member_ID, `setUserTime 함수에서 에러가 발생하였습니다.\n${error}`);
        }
    }

    const userTimeSet = async (user_id, userName, hour, minutes) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [results] = await connection.query(`UPDATE dataInfo SET userTime = '${hour}:${minutes}' WHERE ID = '${userName}'`);
                sendDM(user_id, `알림 시간을 ${hour}시 ${minutes}분으로 설정하였습니다.`);
                connection.destroy();
            } catch (error) {
                connection.destroy();
            }
        } catch (error) {
            sendDM(config.FingerChat_Error_Notice_Member_ID, `userTimeSet 함수에서 에러가 발생하였습니다.\n${error}`);
        }
    }

    const databaseList = async () => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [results] = await connection.query(`SELECT * FROM dataInfo;`);
                connection.destroy();
                userList = [`| No. | User ID | Role | LastItemID | 최종 수정일 | 최종 생성일 | Notice 시간 |\n`, `| --- | --- | --- | --- | --- | --- | --- |\n`];
                if (results.length == 0) {
                    message = `Database에 등록된 User가 없습니다.`
                } else {
                    for (let i = 0; i < results.length; i++) {
/*                         if(results[i].userTime == 'A'){
                            results[i].userTime = '오후 5시 30분';
                        } else {
                            results[i].userTime = '오후 6시';
                        } */
                        userList.push(`| ${i + 1} | ${results[i].ID} | ${results[i].ROLE} | [${results[i].LastItemID}](${config.CodeBeamer_Tracker_Item_URL}${results[i].LastItemID}) | ${results[i].LastModify} | ${results[i].LastCreate} | ${results[i].userTime} |\n`);
                    }
                }
            } catch (error) {
                console.log(error);
                message = `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
                connection.destroy();
            }
        } catch (error) {
            console.log(error);
            message = `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
        }
    }

    const getUserTime = async (userName) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [userYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${userName}') AS SUCCESS;`);
                connection.release();
                if (userYesNo[0].SUCCESS == '0') {
                    return `Database에 User Data가 등록되어있지 않습니다. 먼저 Database에 User Info를 등록해주세요.`;
                } else {
                    try {
                        let [results] = await connection.query(`SELECT userTime FROM dataInfo WHERE ID='${userName}';`);
                        connection.destroy();
                        return `${results[0].userTime}`;
                    } catch (error) {
                        return `에러가 발생하였습니다. 관리자에게 문의하세요.`;
                    }
                }
            } catch (error) {
                connection.destroy();
                return `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
            }
        } catch (error) {
            return `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
        }
    }

    const getUserRole = async (userName) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [userYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${userName}') AS SUCCESS;`);
                connection.release();
                if (userYesNo[0].SUCCESS == '0') {
                    return `Database에 User Data가 등록되어있지 않습니다. 먼저 Database에 User Info를 등록해주세요.`;
                } else {
                    try {
                        let [results] = await connection.query(`SELECT ROLE FROM dataInfo WHERE ID='${userName}';`);
                        connection.destroy();
                        return `${results[0].ROLE}`;
                    } catch (error) {
                        return `에러가 발생하였습니다. 관리자에게 문의하세요.`;
                    }
                }
            } catch (error) {
                connection.destroy();
                return `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
            }
        } catch (error) {
            return `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
        }
    }

    const updateUserRole = async (userName, role) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [userYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${userName}') AS SUCCESS;`);
                connection.release();
                if (userYesNo[0].SUCCESS == '0') {
                    message = `해당 User가 존재하지 않습니다.`;
                    connection.destroy();
                } else {
                    try {
                        let [results] = await connection.query(`UPDATE dataInfo SET ROLE = '${role}' WHERE ID = '${userName}'`);
                        connection.destroy();
                        message = `해당 User가 **'${role}'**으로 설정되었습니다.`;
                    } catch (error) {
                        message = `에러가 발생하였습니다. 관리자에게 문의하세요.`;
                    }
                }
            } catch (error) {
                message = `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
                connection.destroy();
            }
        } catch (error) {
            message = `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
        }
    }


    const removeUser = async (userName) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [userYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${userName}') AS SUCCESS;`);
                connection.release();
                if (userYesNo[0].SUCCESS == '0') {
                    message = `해당 User가 존재하지 않습니다.`;
                    connection.destroy();
                } else {
                    try {
                        let [results] = await connection.query(`DELETE FROM dataInfo WHERE ID = '${userName}'`);
                        connection.destroy();
                        message = `해당 User가 Database에서 삭제되었습니다.`;
                    } catch (error) {
                        message = `에러가 발생하였습니다. 관리자에게 문의하세요.`;
                    }
                }
            } catch (error) {
                message = `Query 에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
                connection.destroy();
            }
        } catch (error) {
            message = `DB에서 에러가 발생하였습니다. 관리자에게 문의하세요.`;
        }
    }

    const getItemMonth = async (userName) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [monthYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${userName}') AS SUCCESS;`);
                connection.release();
                if (monthYesNo[0].SUCCESS == '0') {
                    connection.destroy();
                    return '0';
                } else {
                    try {
                        let [itemMonth] = await connection.query(`SELECT month FROM dataInfo WHERE ID = '${userName}'`);
                        connection.destroy();
                        return itemMonth[0].month;
                    } catch (error) {
                        return 'QueryError';
                    }
                }
            } catch (error) {
                connection.destroy();
                return 'QueryError';
            }
        } catch (error) {
            return 'DBError';
        }
    }

    const getUserHomeTime = async (userName) => {
        try {
            let connection = await pool.getConnection(async conn => conn);
            try {
                let [userYesNo] = await connection.query(`SELECT EXISTS (SELECT * FROM dataInfo WHERE ID='${userName}') AS SUCCESS;`);
                connection.release();
                if (userYesNo[0].SUCCESS == '0') {
                    connection.destroy();
                    return 'DataBase에 등록되지 않은 User입니다. 먼저 item을 생성하여 DataBase에 User를 등록하여주세요.';
                } else {
                    try {
                        let [results] = await connection.query(`SELECT userTime FROM dataInfo WHERE ID = '${userName}'`);
                        connection.destroy();
                        return results[0].userTime;
                    } catch (error) {
                        return 'QueryError';
                    }
                }
            } catch (error) {
                connection.destroy();
                return 'QueryError';
            }
        } catch (error) {
            return 'DBError';
        }
    }

    const noticeToManager = async () => {
        schedule.scheduleJob({ hour: 17, minute: 45, dayOfWeek: [1, 2, 3, 4, 5] }, async () => {
            let date = new Date();
            let tempMonth = date.getMonth() + 1;
            let tempDate = date.getDate();
            if (1 >= tempMonth.toString().length) {
                tempMonth = `0${tempMonth}`;
            }
            if (1 >= tempDate.toString().length) {
                tempDate = `0${tempDate}`;
            }
            let today = `${date.getFullYear()}${tempMonth}${tempDate}`;

            let manager = [];
            try {
                let connection = await pool.getConnection(async conn => conn);
                try {
                    let [results] = await connection.query(`SELECT userID FROM dataInfo WHERE ROLE = 'manager';`);
                    if (results.length != 0) {
                        for (let i = 0; i < results.length; i++) {
                            manager.push(results[i].userID);
                        }
                        try {
                            let [results] = await connection.query(`SELECT ID, LastModify, LastItemID FROM dataInfo;`);
                            connection.destroy();
                            userList = [`| No. | User ID | LastItemID | 최종 수정일 |\n`, `| --- | --- | --- | --- |\n`];
                            for (let i = 0; i < results.length; i++) {
                                if (parseInt((dt.parse(today, 'YYYYMMDD').getTime() - dt.parse(results[i].LastModify.replace(/-/gi, ""), 'YYYYMMDD').getTime()) / (24 * 3600 * 1000)) >= 7) {
                                    userList.push(`| ${i + 1} | ${results[i].ID} | [${results[i].LastItemID}](${config.CodeBeamer_Tracker_Item_URL}${results[i].LastItemID}) | ${results[i].LastModify} |\n`);
                                }
                            }
                            if (userList.length > 2) {
                                for (let i = 0; i < manager.length; i++) {
                                    sendDM(manager[i], `다음 사용자가 업무일지를 작성하지 않고 있습니다.\n[Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                                    sendDM(manager[i], `${userList.join('')}`);
                                }
                            }
                        } catch (error) {
                            sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                            connection.destroy();
                        }
                    } else {
                        connection.destroy();
                    }
                } catch (error) {
                    sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                    connection.destroy();
                }
            } catch (error) {
                sendDM(config.FingerChat_Error_Notice_Member_ID, `Database에서 에러가 발생하였습니다.\n${error}`);
            }
        })
    }
    noticeToManager();

    const reminderGroupAFri = async () => {
        schedule.scheduleJob({ hour: 17, minute: 00, dayOfWeek: [5] }, async () => {
            try {
                let connection = await pool.getConnection(async conn => conn);
                try {
                    let [results] = await connection.query(`SELECT ID, LastModify, userID, userTime FROM dataInfo;`);
                    connection.destroy();
                    for (let i = 0; i < results.length; i++) {
                        if(results[i].userTime == 'A'){
                            sendDM(results[i].userID, `@${results[i].ID}님, 오늘의 업무일지를 작성해주세요. 현재 ${results[i].LastModify}일까지 일지가 작성되어있습니다. [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                        }
                    }
                } catch (error) {
                    sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                    connection.destroy();
                }
            } catch (error) {
                sendDM(config.FingerChat_Error_Notice_Member_ID, `Database에서 에러가 발생하였습니다.\n${error}`);
            }
        })
    }
    //reminderGroupAFri();

    const reminderGroupBFri = async () => {
        schedule.scheduleJob({ hour: 17, minute: 30, dayOfWeek: [5] }, async () => {
            try {
                let connection = await pool.getConnection(async conn => conn);
                try {
                    let [results] = await connection.query(`SELECT ID, LastModify, userID, userTime FROM dataInfo;`);
                    connection.destroy();
                    for (let i = 0; i < results.length; i++) {
                        if(results[i].userTime == 'B'){
                            sendDM(results[i].userID, `@${results[i].ID}님, 오늘의 업무일지를 작성해주세요. 현재 ${results[i].LastModify}일까지 일지가 작성되어있습니다. [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                        }
                    }
                } catch (error) {
                    sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                    connection.destroy();
                }
            } catch (error) {
                sendDM(config.FingerChat_Error_Notice_Member_ID, `Database에서 에러가 발생하였습니다.\n${error}`);
            }
        })
    }
    //reminderGroupBFri();

    const reminderGroupA = async () => {
        schedule.scheduleJob({ hour: 17, minute: 30, dayOfWeek: [1, 2, 3, 4] }, async () => {
            try {
                let connection = await pool.getConnection(async conn => conn);
                try {
                    let [results] = await connection.query(`SELECT ID, LastModify, userID, userTime FROM dataInfo;`);
                    connection.destroy();
                    for (let i = 0; i < results.length; i++) {
                        if(results[i].userTime == 'A'){
                            sendDM(results[i].userID, `@${results[i].ID}님, 오늘의 업무일지를 작성해주세요. 현재 ${results[i].LastModify}일까지 일지가 작성되어있습니다. [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                        }
                    }
                } catch (error) {
                    sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                    connection.destroy();
                }
            } catch (error) {
                sendDM(config.FingerChat_Error_Notice_Member_ID, `Database에서 에러가 발생하였습니다.\n${error}`);
            }
        })
    }
    //reminderGroupA();

    const reminderGroupB = async () => {
        schedule.scheduleJob({ hour: 18, minute: 00, dayOfWeek: [1, 2, 3, 4] }, async () => {
            try {
                let connection = await pool.getConnection(async conn => conn);
                try {
                    let [results] = await connection.query(`SELECT ID, LastModify, userID, userTime FROM dataInfo;`);
                    connection.destroy();
                    for (let i = 0; i < results.length; i++) {
                        if(results[i].userTime == 'B'){
                            sendDM(results[i].userID, `@${results[i].ID}님, 오늘의 업무일지를 작성해주세요. 현재 ${results[i].LastModify}일까지 일지가 작성되어있습니다. [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                        }
                    }
                } catch (error) {
                    sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                    connection.destroy();
                }
            } catch (error) {
                sendDM(config.FingerChat_Error_Notice_Member_ID, `Database에서 에러가 발생하였습니다.\n${error}`);
            }
        })
    }
    //reminderGroupB();

    const asyncWithDatabase = async () => {
        schedule.scheduleJob({ hour: 17, minute: 44, dayOfWeek: [1, 2, 3, 4, 5] }, async () => {
            try {
                let connection = await pool.getConnection(async conn => conn);
                try {
                    let [results] = await connection.query(`SELECT ID, LastItemID FROM dataInfo;`);
                    for (let i = 0; i < results.length; i++) {
                        await axios({
                            method: 'GET',
                            url: `${config.Modify_REST_URL}/${results[i].LastItemID}/history`,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Basic ${config.CB_Authorization}`,
                                'Accept-Language': 'ko/KR'
                            },
                        }).then(async (data) => {
                            try {
                                let connection = await pool.getConnection(async conn => conn);
                                let [result] = await connection.query(`UPDATE dataInfo SET LastModify = '${data.data[data.data.length - 1].submittedAt.slice(0, 10)}' WHERE ID = '${results[i].ID}'`);
                                connection.destroy();
                            } catch (error) {
                                sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                                connection.destroy();
                            }
                        });
                    }
                } catch (error) {
                    sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
                    connection.destroy();
                }
            } catch (error) {
                sendDM(config.FingerChat_Error_Notice_Member_ID, `Database에서 에러가 발생하였습니다.\n${error}`);
            }
        })
    }
    asyncWithDatabase();
};