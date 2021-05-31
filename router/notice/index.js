const fetch = require('node-fetch');
const request = require("request");
const axios = require('axios');
const config = require('../../config/config.json');
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

module.exports = async (app) => {
    try {
        let connection = await pool.getConnection(async conn => conn);
        try {
            let [results] = await connection.query(`SELECT ID, LastModify, userID, userTime FROM dataInfo;`);
            connection.destroy();
            for (let i = 0; i < results.length; i++) {
                let noticeTime = new Date();
                let fridayCheck = noticeTime.getDay();
                let outputTime = [];
                outputTime = results[i].userTime.split(':');
                noticeTime.setHours(outputTime[0]);
                noticeTime.setMinutes(outputTime[1]);
                if(fridayCheck == '5'){
                    noticeTime.setMinutes(noticeTime.getMinutes() - 30);
                }
                if(fridayCheck != '6' || fridayCheck != '0'){
                    if ( Date.now() >= noticeTime.getTime() && Date.now() <= noticeTime.getTime() + 59999) {
                        sendDM(results[i].userID, `@${results[i].ID}님, 오늘의 업무일지를 작성해주세요. 현재 ${results[i].LastModify}일까지 일지가 작성되어있습니다. [Tracker 확인하기](${config.CodeBeamer_Tracker_URL})`);
                    }
                }
            }
        } catch (error) {
            sendDM(config.FingerChat_Error_Notice_Member_ID, `쿼리에서 에러가 발생하였습니다.\n${error}`);
            connection.destroy();
        }
    } catch (error) {
        sendDM(config.FingerChat_Error_Notice_Member_ID, `Database에서 에러가 발생하였습니다.\n${error}`);
    }
}