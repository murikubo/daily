# codeBeamer Daily Journal Bot

## User 사용법 및 관리자 명령어
[hub.slexn.com SLEXN inside wiki - 일일업무일지](http://hub.slexn.com/cb/wiki/14612)

## 관리자 사용법

#### ```config.json``` File Setting
```config.json``` File에는 다음과 같은 config값들이 Setting되어야합니다.
- "Finger_Chat_API_URL" : FingerChat에 Post를 날릴 API 주소입니다.
- "Finger_Chat_API_URL2" : FingerChat에서 dialog를 Open하는 API 주소입니다.
- "Mattermost_Server_URL" : FingerChat Base URL입니다.
- "Mattermost_Bot_Personal_Token" : 사용되는 Bot의 Mattermost Bot Personal Token입니다.
- "Bot_User_Id" : User에게 DM을 보낼 때 사용되는 Bot의 User ID입니다. Mattermost API를 사용하여 Bot의 User ID를 구한 후 Setting해주시면 됩니다.
- "Server_URL" : BOT이 기동되고있는 Server의 URL입니다.
- "Direct_URL" : DM을 보낼 때 사용되는 POST API URL입니다.
- "CB_Authorization" : codeBeamer(hub.slexn.com)의 User 인증값 입니다. Item 생성 및 수정에 사용될 codeBeamer User 인증키(발급 방법은 codeBeamer API 문서를 참조하시길 바랍니다.)를 Setting해주시면 됩니다.
- "Modify_REST_URL" : codeBeamer의 REST URL입니다.
- "CodeBeamer_Tracker_Item_URL" : DB에 저장된 Item ID를 불러와 Link를 불러올 ```http://YOUR_CODEBEAMER_URL/cb```형식의 URL입니다.
- "CodeBeamer_Tracker_URL" : 업무일지 Tracker의 URL입니다.
- "CodeBeamer_Tracker" : 업무일지 Tracker의 ```/tracker/ID``` 형식의 ID입니다.
- "FingerChat_Error_Notice_Member_ID" : Bot 작동중 Error가 발생했을 시 DM으로 알림을 받을 FingerChat의 User ID입니다.
- "Use_Port, DB_Host, DB_Port, DB_User, DB_Password, DB_Database" : 각각 DB 접속정보입니다.
- "VERSION" : Bot의 Version 정보입니다.