
function fnEnterkey(gubun){
    
    if (window.event.keyCode == 13) {      
        if(gubun == 'fido'){    // 생체인증 로그인
            authReadyPre();
        }else if(gubun == 'kakao'){ //카카오 로그인
            fnLoginKakao('formKakao');
        }else if(gubun == 'com'){   //일반 로그인
            fnLoginCom('loginFormCom');
        }else if(gubun == 'regPinNo'){    //간편번호 신규 등록
            fnStartPinReg(gubun);
        }else if(gubun == 'reRegPinNo'){    //간편번호 재 등록
            fnStartPinReg(gubun);
        }else if(gubun == 'pinLogin'){    //간편번호 로그인
            fnLoginPin();
        }else if(gubun == 'NextStep'){  //로그인 유예신청 로그인
            fnToNextStep();
        }else if(gubun == 'emailAuth'){ //학번/사번 찾기 이메일 인증코드 입력
            fnSelfAuth('findId', 'emailAuth');
        }else if(gubun == 'emailPwAuth'){   //비밀번호 찾기 이메일 인증코드 입력
            fnSelfAuth('findPw', 'emailAuth');
        }else if(gubun == 'phoneAuth'){   //비밀번호 찾기 휴대폰 인증 학번 입력
            fnSelfAuth('findPw', 'phoneAuth');
        }else if(gubun == 'userInfoAuth'){  //학번/사번 찾기 이름, 생년월일 입력      
            fnSelfAuth('findId', 'userInfoAuth');
        }else if(gubun == 'userInfoPwAuth'){    //비밀번호 찾기 이름, 생년월일 입력
            fnSelfAuth('findPw', 'userInfoAuth');
        }else if(gubun == 'PchangePw'){ //휴대폰 인증 비밀번호 변경
            fnSelfAuth('phone');
        }else if(gubun == 'EchangePw'){ //이메일 인증 비밀번호 변경
            fnSelfAuth('email');
        }else if(gubun == 'checkIdAndNm'){ //
            fnCheckIdAndNm();
        }else if(gubun == 'pkiReg'){    // 공동인증서 등록
            fnPKIReg();
        }else if(gubun == 'mfa') {
            fnLoginMfa(); // 외부 2차인증
        }
    }
}

function fnNumberKey(){

    if(window.event.keyCode >= 48 && window.event.keyCode <= 57 ){
        return true;
    }
    return false;
}

function fnCheckEngAndHan(obj){

    const inputVal = $(obj).val();

    const regex = RegExp(/[^가-힣a-zA-Z]/);
    if(!regex.test(inputVal) == true){
        return true;
    }
    return false;
}

/**
 *  alert, confirm 대용 팝업 메소드 정의 <br/>
 *  aniTimer : 애니메이션 동작 속도 <br/>
 *  alert : 경고창 <br/>
 *  confirm : 확인창 <br/>
 *  open : 팝업 열기 <br/>
 *  close : 팝업 닫기 <br/>
 */ 
var fnOpenAlertPopup = {
    aniTimer: 0,
    confirm: function (title, txt, callback) {

        if (txt == null || txt.trim() == "") {
            console.warn("confirm message is empty.");
            return;
        } else if (callback == null || typeof callback != 'function') {
            console.warn("callback is null or not function.");
            return;
        } else {
            $(".type-confirm .btn_ok").on("click", function () {

                $(this).unbind("click");
                callback(true);
                fnOpenAlertPopup.close(this);
                fnResetPopupSetting();
            });
            
            $(".type-confirm .modal_close").on("click", function () {
                if($(this).parents('.popup-wrap').is('[data-tooltip-con]')){
                    var t = $(this).parents('.popup-wrap').attr('data-tooltip-con');
                    $('[data-tooltip="' + t + '"]').focus();
                }

                $(this).unbind("click");
                callback(false);
                fnOpenAlertPopup.close(this);
                fnResetPopupSetting();
      
            });
            
            this.open("type-confirm", txt, title);          
        }
    },

    alert: function (title, txt, callback) {

        if (txt == null || txt.trim() == "") {
            console.warn("confirm message is empty.");
            return;
        } else {
            $(".type-alert .modal_close").on("click", function () {
                if($(this).parents('.popup-wrap').is('[data-tooltip-con]')){
                    var t = $(this).parents('.popup-wrap').attr('data-tooltip-con');
                    $('[data-tooltip="' + t + '"]').focus();
                }

                $(this).unbind("click");
                callback(true);
                fnOpenAlertPopup.close(this);
                fnResetPopupSetting();

            });
            this.open("type-alert", txt, title);
        }
    },

    open: function (type, txt, title) {  
        openPopupYN = "Y";
        var popup = $("." + type);
        popup.find(".head-title").html(title);
        popup.find(".menu_msg").html(txt);
//        $("body").append("<div class='dimLayer'></div>");
//        $(".dimLayer").css('height', $(document).height()).attr("target", type);
        popup.css('display','flex').fadeIn(this.aniTimer);
        //스크롤 막기
        $('body').addClass('notScroll');
        setTimeout(function(){
            popup.find('.popup-button button:first-child').focus();         
        }, 0);
    },

    close: function (target) {
        openPopupYN="N";
        var modal = $(target).closest(".popup-wrap");
        if (modal.hasClass("type-confirm")) {
            $(".type-confirm .btn_ok").unbind("click");
        }else if (modal.hasClass("type-alert")) {

        } else{
            console.warn("close unknown target.");
            return;
        }
        modal.fadeOut(this.aniTimer);
        setTimeout(function () {
        }, this.aniTimer);
        $('body').removeClass('notScroll');
    },
    
    changeConfirmBtnNm: function(nm1, nm2){
        $(".type-confirm .btn_ok").html(nm1);
        $(".type-confirm .modal_close").html(nm2);
    },
    
    changeAlertBtnNm: function(nm){
        $(".type-alert .modal_close").html(nm);
    },

    changeTextAlign: function(align){
        $('.body-contentbox .menu_msg').css('text-align', align);
    },
    
    createInputBox: function(placeholder, maxlength){
         $('#inputVal').css('display', 'block');
         $('#inputVal').attr('placeholder', placeholder);
         $('#inputVal').attr('maxlength', maxlength);
    },
    
    createCloseBtn: function(){
        $('#popupCloseBtn').css('display', 'block');
    }
}

function fnResetPopupSetting(){
    
    $(".type-confirm .btn_ok").html('확인');
    $(".type-confirm .modal_close").html('취소');
    $(".type-alert .modal_close").html('확인');
    $('#inputVal').css('display', 'none');
    $('#inputVal').attr('placeholder', '');
    $('#inputVal').attr('maxlength', '20');
    $('#popupCloseBtn').css('display', 'none');
}

function fnCheckFormat(regex, val){    
    return regex.test(val);
}

function fnCheckValid(val){
    if(val == '' || val == null || val == undefined || val == 'null'){
        return false;
    }
    return true;
}

function fnLodingOpen(){
    $('.loading-popup').empty();
    
    let str = '<div class="box">';    
    str +=    '<div>';
    str +=      '<div class="c1"></div>';
    str +=      '<div class="c2"></div>';    
    str +=      '<div class="c3"></div>';    
    str +=      '<div class="c4"></div>';    
    str +=    '</div>';
//    str +=    '<span>처리중이니 잠시만 기다려주세요.</span>';
    str +=    '</div>';
    str += '</div>'; 
    
    $('.loading-popup').append(str);

    $('.loading-popup').show();
}

function fnLodingClose(){
    $('.loading-popup').hide();
}


//접근성 관련 포커스 강제 이동
function accessibilityFocus() {
  
  $(document).on('keydown', '[data-focus-prev], [data-focus-next]', function(e){
    var next = $(e.target).attr('data-focus-next'),
        prev = $(e.target).attr('data-focus-prev'),
        target = next || prev || false;
    
    if(!target || e.keyCode != 9) {
      return;
    }
    
    if( (!e.shiftKey && !!next) || (e.shiftKey && !!prev) ) {
        $('[data-focus="' + target + '"]').focus();
        setTimeout(function(){
            $('[data-focus="' + target + '"]').focus();
        }, 1);
    }
    
  });
}

//웹, 앱 판별
function isNative() {
    return /inApp/i.test(window.navigator.userAgent);
}

function fnCheckUserInfo(inputId, inputPwd, inputNm, inputBirthDay, gubun, isUserIdCheck){
    
    const inputIdVal = (inputId == 'none') ? 'none' : inputId.val();
    const inputPwdVal = (inputPwd == 'none') ? 'none' : inputPwd.val();
    const inputNmVal = (inputNm == 'none') ? 'none' : inputNm.val();
    const inputBirthDayVal = (inputBirthDay == 'none') ? 'none' : inputBirthDay.val();

    if (inputIdVal != 'none' && inputIdVal == ''){
        fnOpenAlertPopup.alert('알림', '학번을 입력하세요.', function (res) {
            if (res) {   
                inputId.focus();
            }
        });
        return false;
    } 
    
    // 카카오, 일반로그인, 유예신청 경우에만 해당
    if (inputPwdVal != 'none' && inputPwdVal == '') {
        fnOpenAlertPopup.alert('알림', '비밀번호를 입력하세요.', function (res) {
            if (res) { 
                inputPwd.focus();
            }
        });
        return false;
    } 
    
    if (inputNmVal != 'none' && inputNmVal == '') {
        fnOpenAlertPopup.alert('알림', '이름을 입력하세요.', function (res) {
            if (res) { 
                inputNm.focus();
            }
        });
        return false;
    } 
  
    if (inputBirthDayVal != 'none' && (inputBirthDayVal == "" || inputBirthDayVal.length < 6)) {
        fnOpenAlertPopup.alert('알림', '생년월일 6자리를 입력하세요.', function (res) {
            if (res) { 
                inputBirthDay.focus();
            }
        });
        return false;
    } 

    // 카카오 인증 할때 카카오에서 동의 받고 있어서 밸리데이션 체크 제외(2025.03.28)
/*    if(gubun == 'kakao'){
        // 개인정보이용동의
        if(!$("input[id=personalAggrCheck]").is(":checked")){

            fnOpenAlertPopup.alert('알림', '개인정보 제공 동의를 체크해 주세요.', function (res) {
                if (res) {
                    $("#personalAggrCheck").focus();
                }
            });
            return false;
        }
    }*/
    
    if(isUserIdCheck == false){
        return true;
    }
    
    // 학번과 비번 유효성, 비밀번호 오류횟수, 제적생 여부
    const result = fnAuthReady(inputIdVal, inputPwdVal, gubun);
    
    if(result.ret.retVAL == 'isUserIdExist'){
        if(gubun == 'fido'){
            var jsonObj = JSON.stringify($("#fidoForm").serializeObject());
            
            $.ajax({
                type:"POST",
                // deviceId는 클라이언트에서 전송, pushMsg에는 QR코드 내용이 들어가야 함, authCode는 옵션
                data : jsonObj
               ,dataType : "JSON"
               ,contentType : "application/json; charset=UTF-8"
               ,url: fidoUrl + "/AuthReady.jspx"
               ,success: authSuccess
               ,error : authError
            });
        }
    }else if (result.ret.retVAL == 'isNotAvailable'){
        if(gubun == 'fnCheckIdAndNm'){
            $('.dl_wrap04.type01 .error_wrap').addClass('active');
            $('#errorMsg').empty();
            $('#errorMsg').html('* 학생만 초기화 신청할 수 있습니다.<br>정보운영팀(02-2290-0207)으로 신청 부탁드립니다.');
            $('#errorMsg').show();
            return false;
        }
    }else if(result.ret.retVAL == 'isNotExist'){
        if(gubun == 'fnCheckIdAndNm'){
            $('.dl_wrap04.type01 .error_wrap').addClass('active');
            $('#errorMsg').empty();
            $('#errorMsg').html('* 학번과 이름이 일치 하지 않습니다. 학번 분실 시, 학번 찾기를 진행해 주세요. '+
            '<a href="#" onclick="fnReqOpenPopup(\'findId\', \'N\');" class="btn btn_point" title="학번 찾기">학번 찾기</a>');
            $('#errorMsg').show();
        }else{
            let isReload = 'Y';

            if(gubun == 'fnCheckIdAndNm' || gubun == 'delayApply' || gubun == 'pki'){
                isReload = 'N';
            }
            
            // ISMS 조치사항 20240418
            //fnOpenAlertPopup.alert('알림', '입력하신 학번을 확인해주세요.<br><br>'+
            // 아이디 틀린 경우 ISMS 조치사항 20250422
            fnOpenAlertPopup.alert('알림', '입력하신 학번/비밀번호를 확인해주세요.<br>'+'5회 초과 실패 시 로그인이 제한됩니다.<br><br>'+
                    '※ 재학생인 경우 <a href="#" onclick="fnReqOpenPopup(\'findId\', \''+isReload+'\');">[학번 찾기]</a> 진행<br>'+
                    '※ 신,편입생인 경우 학적 생성 전까지는 '+ 
                    '<a href="https://go.hycu.ac.kr" target="_blank">[입학홈페이지]</a>', function (res) {
                if (res) { 
                    inputId.focus();
                }
            });
        }
        return false;
    }else if(result.ret.retVAL == 'isExpelledStd'){
        
        if(gubun == 'fnCheckIdAndNm'){
            $('.dl_wrap04.type01 .error_wrap').addClass('active');
            $('#errorMsg').empty();
            $('#errorMsg').html('* 제적생은 비밀번호 초기화를 신청할 수 없습니다.<br>'+
            '* 제적생 증명서 발급은 인터넷증명센터에서 가능합니다. <a href="https://www.hycu.ac.kr/user/unGdInfo/goMain/certificate/certificate.do" target="_blank">[인터넷증명센터 바로가기]</a>');
            $('#errorMsg').show();
        }else{
            let msg = '제적생은 이용할 수 없습니다.<br>';
            
            if(gubun == 'kakao' || gubun == 'com' || gubun == 'pki' || gubun == 'pin' || gubun == 'fido'){
                msg = '제적생은 로그인 할 수 없습니다.<br>';
                msg += '※ 제적생 증명서 발급은 <a href="https://www.hycu.ac.kr/user/unGdInfo/goMain/certificate/certificate.do" target="_blank">[인터넷증명센터]</a> 이용';
            }
            
            fnOpenAlertPopup.alert('알림', msg, function (res) {
                if (res) { 
                    inputId.focus();
                }
            });
        }
        return false;
    }else if(result.ret.retVAL == 'isPreStd'){
        // 초기화 신청
        if(gubun == 'fnCheckIdAndNm'){
            $('.dl_wrap04.type01 .error_wrap').addClass('active');
            $('#errorMsg').empty();
            $('#errorMsg').html('* 신,편입생인 경우 학적 생성 전까지는 비밀번호 초기화 신청을 할 수 없습니다.<br>'+
            '* <a href="https://entr.hycu.ac.kr/com/SsoCtr/initPageWork.do?univGbn=schaff&logout=1" target="_blank">[입학홈페이지]</a>에서 비밀번호 찾기를 이용해주세요.');
            $('#errorMsg').show();
        }else{
            let msg = '';
            
            if(gubun == 'kakao' || gubun == 'pki' || gubun == 'pin' || gubun == 'fido'){
                msg = '학습로그인은 학적 생성 (1학기는 2월 마지막 주 금요일, 2학기는 8월 마지막 주 금요일 예정) 이후에 가능합니다.<br>' + 
                      '<a href="/" onclick="normalTabOpen(); return false;">[일반로그인]</a>을 이용해주세요';
            }
            
            if(gubun == 'delayApply'){
                msg = '학습로그인 유예 신청은 학적 생성 (1학기는 2월 마지막 주 금요일, 2학기는 8월 마지막 주 금요일 예정) 이후에 가능합니다.';
            }
            
            if(gubun == 'findId'){
                msg = '* 신,편입생인 경우 ' + 
                '<a href="https://entr.hycu.ac.kr/com/SsoCtr/initPageWork.do?univGbn=schaff&logout=1" target="_blank">[입학홈페이지]</a>' + 
                '에서 수험번호찾기를 이용해주세요.'
            }
            
            if(gubun == 'findPw' || gubun == 'findPwPhoneAuth' ){
                msg = '* 신,편입생인 경우 ' + 
                '<a href="https://entr.hycu.ac.kr/com/SsoCtr/initPageWork.do?univGbn=schaff&logout=1" target="_blank">[입학홈페이지]</a>에서<br>' + 
                '  비밀번호찾기를 이용해주세요.'
            }
            
            fnOpenAlertPopup.alert('알림', msg, function (res) {
                if (res) { 
                }
            });
        }
        return false;
    }else if(result.ret.retVAL == 'isOverPwdErrorCnt'){
        let isReload = 'Y';
        if(gubun == 'delayApply'){
            isReload = 'N';
        }
        
        fnOpenAlertPopup.alert('알림', '비밀번호 5회 이상 실패하여<br>더 이상 로그인 할 수 없습니다.<br><br>' + 
                '<a href="#" onclick="fnReqOpenPopup(\'findPw\', \''+isReload+'\');" title="현재 팝업 닫고, 비밀번호찾기 내부 팝업 열기">[비밀번호 찾기]</a>'+
                '에서<br>'+
                '비밀번호 재설정 후 로그인해 주세요.', function (res) {
            if (res) {  
                inputId.focus();
            }
        });
        return false;
    }else if(result.ret.retVAL == 'isPwdMisMatch'){

        let isReload = 'Y';

        if (gubun == 'fnCheckIdAndNm' || gubun == 'delayApply' || gubun == 'pki') {
            isReload = 'N';
        }

        // ISMS 조치사항 20240418
        //fnOpenAlertPopup.alert('알림', '비밀번호 입력 '+result.ret.errCnt+'회 실패하였습니다.<br>'+
        // 비밀번호 틀린 경우 ISMS 조치사항 20250422
        fnOpenAlertPopup.alert('알림', '입력하신 학번/비밀번호를 확인해주세요.<br>' +
            '5회 초과 실패 시 로그인이 제한됩니다.<br><br>' +
            '로그인 정보 입력 ' + result.ret.errCnt + '회 실패하였습니다.<br><br>' +
            '※ 재학생인 경우 <a href="#" onclick="fnReqOpenPopup(\'findId\', \'' + isReload + '\');">[학번 찾기]</a> 진행<br>' +
            '※ 신,편입생인 경우 학적 생성 전까지는 ' +
            '<a href="https://go.hycu.ac.kr" target="_blank">[입학홈페이지]</a>', function (res) {
            if (res) {
                inputPwd.focus();
            }
        });
        return false;
    }else if(result.ret.retVAL == 'nonPassMyAuth'){
         fnOpenAlertPopup.changeConfirmBtnNm('인증', '취소');  
         fnOpenAlertPopup.confirm('알림', '카카오 인증은 휴대폰 본인인증 완료 후 이용 가능하니<br>'+
         '휴대폰 본인인증해 주세요.', function (res) {
             if (res) {      
                //휴대폰 본인인증
                let params = {};
                params.gubun = 'selfAuth';
                params.userId = inputIdVal;
                fnPhoneAuth(params);
             }
         });
         return false;
    }else if(result.ret.retVAL == 'isError'){
        
        if(gubun == 'fido'){
            fnFidoPopupClose();
        }
        
        fnOpenAlertPopup.alert('알림', '처리 중 오류가 발생하였습니다.<br>'+
                '담당자(02-2290-0207)에게 문의 부탁드립니다.', function (res) {
            if (res) { 
                inputId.focus();
            }
        });
        return false;
    }else if(result.ret.retVAL == 'isNotExistISMS'){
        let isReload = 'Y';
        if(gubun == 'delayApply'){
            isReload = 'N';
        }
        
        fnOpenAlertPopup.alert('알림', '학번 또는 비밀번호가 일치하지 않습니다.<br><br>'+                    
                '※ 재학생인 경우 <a href="#" onclick="fnReqOpenPopup(\'findId\', \''+isReload+'\');">[학번 찾기]</a>' +
                ' 또는 ' + 
                '<a href="#" onclick="fnReqOpenPopup(\'findPw\', \''+isReload+'\');" title="현재 팝업 닫고, 비밀번호찾기 내부 팝업 열기">[비밀번호 찾기]</a>' +
                '<br>'+
                '※ 신,편입생인 경우 학적 생성 전까지는 '+ 
                '<a href="https://go.hycu.ac.kr" target="_blank">[입학홈페이지]</a>' + 
                '※ 제적생은 로그인 할 수 없습니다.<br>&nbsp;&nbsp;&nbsp;&nbsp;' + 
                '제적생 증명서 발급은 <a href="https://www.hycu.ac.kr/user/unGdInfo/goMain/certificate/certificate.do" target="_blank">[인터넷증명센터]</a> 이용'
                
                , function (res) {
            if (res) { 
                inputId.focus();
            }
        });
        
        return false;
    }
    
    return true;
}

function normalTabOpen(){
    // $.cookie("cookieFocusCheck", "Normal", {path: "/", domain: location.hostname, expires : 7});
    $.cookie("cookieFocusCheck", "Normal", {path: "/", domain: ".hycu.ac.kr", expires : 7});
    $('#container .tab .tab_btn_box .tab_btn_list li').removeClass('active');
    $('#container .tab .tab_cont_box').removeClass('on');   

    list_active = $('#container .tab_btn_list li[data-tab="defaultLogin"]');
   
    list_active.addClass('active');

    $('#defaultLogin').addClass('on');
    $('#loginIdCom').focus();
}

function fnAuthReady(userId, userPwd, gubun) {

    let params = {};
    let result = "";

    let rsa = new RSAKey();
    // pki 로그인인 경우 부모창에서 RSA 키를 가져옴(iframe에서 pki 로그인 시 부모창에 RSA 키가 있음)
    if (gubun === 'pki') {
        rsa.setPublic(window.parent.$('#RSAModulus').val(),
            window.parent.$('#RSAExponent').val());

    } else {
        rsa.setPublic($('#RSAModulus').val(), $('#RSAExponent').val());
    }

    // 아이디와 비밀번호는 RSA 암호화 후 전송
    params.persNo = rsa.encrypt(userId);
    params.pwd = rsa.encrypt(userPwd);

    // params.persNo = userId;
    // params.pwd = userPwd;
    params.gubun = gubun;
    
    fnLodingOpen();
    
    $.ajax({
        url : "/sso/LoginCtr/findAuthReady.do",
        data : params,
        type : 'post',
        dataType : 'json',
        async : false,
        success : function(rslt) {
            result = rslt;       
        }, error : function(requst, status) {
            result = "isError";
        }, complete : function(){
            fnLodingClose();
        }
    });
    
    return result;
}

var authValidTime = -1;
var authTimeMin = -1;
var authTimeSec = -1;

function fnSettingTimer(timeObj){

    if(authTimeMin == 0 && authTimeSec == 0){
        return;
    }

    if(authValidTime == -1){
        authValidTime = Date.now();
    }

    const processTime = ((Date.now() - authValidTime) / 1000);

    authTimeMin = Math.floor((4 - parseInt(processTime / 60)));
    authTimeSec = Math.floor((60 - processTime % 60));

    authTimeMin = (authTimeMin <= 0) ? 0 : authTimeMin;
    authTimeSec = (authTimeSec <= 0) ? 0 : authTimeSec;

    let txtMin = '0' + authTimeMin;
    let txtSec = authTimeSec;

     if(authTimeSec < 10){
         txtSec = '0' + authTimeSec;
     }

     timeObj.text(txtMin + ' : ' + txtSec);
}

function fnRemoveStorageItem(keyName){
    window.localStorage.removeItem(keyName);
}

function fnReqOpenPopup(gubun, isReload){
    window.localStorage.setItem('openPopup', gubun);

    if(isReload == 'Y'){
        location.reload();
    }else{
        setTimeout(function(){
            window.open('/');
        },0);
    }
}

function fnResOpenPopup(){
    const popup = window.localStorage.getItem('openPopup');
    if(fnCheckValid(popup)){
        if(popup == 'findPw'){
            fnOpenPopup('findPw');
        }else if(popup == 'findId'){
            fnOpenPopup('findId');
        }

    }
}

function fnIsTablet(){

    const agent = navigator.userAgent.toLowerCase();

    let isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(agent);
    // 아이패드 사파리, 파이어폭스의 경우
    if(isTablet == false && (agent.indexOf('macintosh') != -1 && navigator.maxTouchPoints > 1)){
        isTablet = true;
    }

    return isTablet;
}

function fnIsLearningX(){

    const agent = navigator.userAgent.toLowerCase();

    let isLearningX = /learningx/.test(agent);

    return isLearningX;
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function getHycuAppVersion(){
    const ua = navigator.userAgent.toLowerCase();
    const reg = new RegExp(/hycuapp appversion\/\d{3}/, "gi");
    let version= ua.match(reg);
    let ret = 0;

    // 앱 체크
    if(!/hycuapp/i.test(ua)){
        return -1;
    }

    // 버전 정보 있는 지 체크
    if(!fnCheckValid(version)){
        return -2;
    }

    ret = version[0].substr(-3, 3);

    return ret;
}