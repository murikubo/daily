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
- "FingerChat_Error_Notice_Member_ID" : Bot 작동중 Error가 발생했을 시 DM으로 알림을 받을 FingerChat의 User ID입니다. Admin의 User ID를 입력하시면 됩니다.
- "Use_Port" : Bot을 기동시킬 Port번호입니다.
- "DB_Host, DB_Port, DB_User, DB_Password, DB_Database" : 각각 DB 접속정보입니다.
- "VERSION" : Bot의 Version 정보입니다.


### 기동 후 Role 정보
- Admin : System의 관리자입니다. 권한 : 1, 2, 3, 4, 5, 6 (개발 및 유지보수, 모니터링 용도로 부여된 권한입니다.)
- Manager : System의 매니저입니다. 권한 : 1, 2, 3, 4, 5, 7 (Error Notice외, 운영에 필요한 모든 권한을 소유합니다.)
- User : User입니다. 권한 : 1, 2

#### 권한
- 1 : 업무일지를 작성할 수 있습니다.
- 2 : 본인의 알림받을 시간을 설정 가능합니다.
- 3 : User의 각종 Role을 설정 할 수 있습니다.
- 4 : User를 제거할 수 있습니다.
- 5 : User 현황을 조회할 수 있습니다.
- 6 : 에러가 발생할 시에 Error Notice가 DM으로 전송됩니다.
- 7 : 일정 기간 User가 업무일지를 작성하지 않을 경우 알림 DM이 옵니다.