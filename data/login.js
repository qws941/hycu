let authTime = 0;
let min = "";
let sec = "";
let intervalId = "";

var magicsa = null;

var openPopupYN = 'N';

var tabFlag = false;
var virtualKey = "";
var shiftKey = false;

// 23. 3. 7. IE 호환성을 위해 변경 (M365 앱 로그인)
//const url = new URL(window.location.href);
$(document).ready(function(){
    
    const magicsaProp = {
            serverUrl : MAGICMOA_SERVER_URL,
            keyName: "keyStore",
            isUsingFailCount: "false",
            isResetAuthFailure: "true"
    }
    
    magicsa = new MagicSA(magicsaProp); 

    //alert('<spring:message code="lms.common.text117"></spring:message>');
    
    detection();
    // 23. 3. 7. IE 호환성을 위해 변경 (M365 앱 로그인)
    //if(url.searchParams.get('kmcis') === 'Y'){
    if(getParameterByName('kmcis') === 'Y'){
        window.close();
        return;
    }

    //모바일 생체인증, 공동인증 버튼 숨김
    if('PC' != DEVICE) {  
        $('#userId').hide();
        if(DEVICE.indexOf("APP") != -1){
            $('#livingText').empty().append('등록된 생체정보로 로그인해 주세요.');
            $('#container .tab .tab_cont_box .form_list').addClass('mobile');   //공동인증서 로그인 폼 삭제
            $(".ckwrap .login_info_dr li:last-child").remove(); //로그인 안내에서 공동인증서 안내 삭제
        }else if(DEVICE.indexOf("APP") == -1){
            $('#livingText').empty().append('모바일, 테블릿의 웹에서는 지원하지 않습니다.​<br>한사대로 앱이나, 다른 학습 로그인 이용 부탁드립니다. ');
            
            if(fnIsTablet() == false){                                               
                $('#container .tab .tab_cont_box .form_list').addClass('mobile');   //공동인증서 로그인 폼 삭제
                $(".ckwrap .login_info_dr li:last-child").remove(); //로그인 안내에서 공동인증서 안내 삭제
            }
        }
    }
    
    if(fnIsTablet() == true && DEVICE.indexOf("APP") == -1){ // 테블릿인 경우 공동 인증서 로그인 버튼 삭제
        $('#userId').hide();
        $('#livingText').empty().append('모바일, 테블릿의 웹에서는 지원하지 않습니다. ​<br>한사대로 앱이나, 다른 학습 로그인 이용 부탁드립니다. ');
        $('.form_list .form_item.certificate').addClass('not_pc');
    }
    
    if( $.cookie("cookieLoginCheckKakao") == "Y"){
        $("#cookieLoginCheckKakao").prop("checked","checked") ;
        $("#loginIdKakao").val($.cookie("loginId"));
        $("#loginIdCom").val($.cookie("loginId"));
        $("#userId").val($.cookie("loginId"));
    }

    // 2025-09-02 외부망 2차 인증 로그인시 아이디 저장
    if( $.cookie("cookieLoginCheckMfa") == "Y"){
        $("#cookieLoginCheckMfa").prop("checked","checked") ;
        $("#loginIdMfa").val($.cookie("loginIdMfa"));
    }
    
    $('#dscertContainer').hide();
    
    // 찾기 폼 초기화
    fnInitFindInfo();
    
    $('.tab_btn_list li').click(function() {
        var activeTab = $(this).attr('data-tab');
        $('.tab_btn_list li').removeClass('active');
        $('.tab_cont_box').removeClass('on');
        $(this).addClass('active');
        $('#' + activeTab).addClass('on');
    });


    $('#learningLogin .m_btn').on("click", function() {

        if($(this).parents('.form_item').hasClass('active') == false){
            $('#learningLogin .form_item').removeClass('active');
            $(this).parents('.form_item').addClass('active');
            
        }else{
            $('#learningLogin .form_item').removeClass('active');
        }
        return false;
    });    
    
    $(".login_info_dr p").click(function(){
        if($(".login_info_dr").hasClass("active")){
            $(this).next('ul').hide();
            $(".login_info_dr").removeClass('active');
        }else{
            $(this).next('ul').show();
            $(".login_info_dr").addClass('active');
        }       
    });
    
    $(".login_info_dr p").on("keyup",function(key){
        if(key.keyCode==13) {
            $(".login_info_dr p").trigger('click');
            $('.ckwrap .login_info_dr li:first-child a').focus();
        }
    });
    
    $(document).on("keydown",".ckwrap .login_info_dr li:last-child",function(key){
        if(key.keyCode == 9 ) {
            if(key.shiftKey){
                $(this).prev().focus();
            }else{
                $('.login_info_dr p').next('ul').hide();
                $('.login_info_dr').removeClass('active');             
            }
        }
    });
    
    $('.ckwrap .login_info_dr li:first-child').on("keydown",function(key){
        if(key.keyCode == 9 ) {
            if(key.shiftKey){
                $('.login_info_dr p').next('ul').hide();
                $('.login_info_dr').removeClass('active');     
            }else{
                $(this).next().focus(); 
            }
        }
    });
    
    // 웹접근성 학번/비밀번호찾기 탭 활성화
    $(".sId_item").keyup(function(event) {
        if (event.keyCode === 13) {
            $(this).click();
        }
    });
    
    fnKakaoErrorMsg(KAKAO_ERROR_CODE);
    fnLoginErrorMsg(LOGIN_ERROR_CODE);
    // 로그인 인증 점검 여부 확인
    checkLoginConf();  
    
    accessibilityFocus();

    $(document).on('click','[data-tooltip]', function() {
        var t = $(this).attr('data-tooltip');
        $('.popup-wrap').attr('data-tooltip-con',t);
    });
    
    // 간편번호 키보드 입력 처리
    $(document).on('keyup', function(e) { 
        
        shiftKey = e.shiftKey;

        if($('.ui-keyboard-preview-wrapper').length > 0){
            
            //preTabFocusNm = document.activeElement.name;              
            virtualKey = e.key;
        }else{
            tabFlag = false;
            virtualKey = '';
        }       
    });
    
    $('.modal_close').mouseup(function(){
        virtualFlag = false;
    });
    
    fnResOpenPopup();

    fnOpenVitualKeyboard($('#pinNo'));
    fnOpenVitualKeyboard($('#pinNo1'));
    fnOpenVitualKeyboard($('#pinNo2'));
    
    // 간편번호 기본 폼 
    fnDefaultPinLoginForm();

    if(PHONE_AUTH_GUBUN == 'findId' || PHONE_AUTH_GUBUN == 'findPw'){
        fnOpenPopup(PHONE_AUTH_GUBUN);
        fnMobileRespMyCert();
    }else if(PHONE_AUTH_GUBUN == 'selfAuth'){
        // 기존 디폴트 탭 정보 제거
        let list_active = $('#container .tab_btn_list li');
        list_active.removeClass('active');
        $('#container .tab .tab_cont_box').removeClass('on');  
        
        // 스마트 로그인 탭으로 변경
        list_active = $('#container .tab_btn_list li[data-tab="learningLogin"]');                  
        list_active.addClass('active');
        $('#learningLogin').addClass('on');
        
        // 카카오 로그인 폼 활성화
        $('#container .tab .tab_cont_box .form_list.mobile .form_item kakao').addClass('active');
        fnMobileRespMyCert();
    }
    
    $('.ckwrap .login_info_dr li a').click(function(){
        $('.ckwrap .login_info_dr').removeClass('active');
        $('.ckwrap .login_info_dr ul').hide();
    });
    
    fnLoginFocus();

});   

//detection
function detection() {
    var getAgent = document.documentElement;
    getAgent.setAttribute("data-useragent", navigator.userAgent);
    var sBrowser, sUsrAg = navigator.userAgent;

    var resetUserAgent = function (i, classname) {
        var classes = classname.split(' ');
        var rets = [];
        for (var i = 0; i < classes.length; i++) {
            if (classes[i].indexOf('browser-') !== -1) rets.push(classes[i]);
        }
        return rets.join(' ');
    };

    if (sUsrAg.indexOf("Firefox") > -1 || sUsrAg.indexOf('FxiOS') > -1) {
        sBrowser = "browser-firefox";
    } else if (sUsrAg.indexOf("KAKAOTALK") > -1) {
        sBrowser = "browser-kakao";
    } else if (sUsrAg.indexOf("SamsungBrowser") > -1) {
        sBrowser = "browser-samsung";
    } else if (sUsrAg.indexOf("Whale") > -1) {
        sBrowser = "browser-whale";
    } else if (sUsrAg.indexOf("NAVER") > -1) {
        sBrowser = "browser-naver";
    } else if (sUsrAg.indexOf("Opera") > -1 || sUsrAg.indexOf("OPR") > -1) {
        sBrowser = "browser-opera";
    } else if (sUsrAg.indexOf("Edge") > -1 || sUsrAg.indexOf("Edg") > -1) {
        sBrowser = "browser-edge";
    } else if (sUsrAg.indexOf("Trident") > -1) {
        sBrowser = "browser-explorer";
    } else if (sUsrAg.indexOf("Chrome") > -1 || sUsrAg.indexOf('CriOS') > -1) {
        sBrowser = "browser-chrome";
    } else if (sUsrAg.indexOf("Safari") > -1) {
        sBrowser = "browser-safari";
    } else if (sUsrAg.indexOf("Instagram") > -1) {
        sBrowser = "browser-instagram";
    }

    $('html').removeClass(resetUserAgent).addClass(sBrowser);

    var filter = "win16|win32|win64|mac|macintel";

    if (filter.indexOf(navigator.platform.toLowerCase()) > 0) {
        $('html').addClass('device-web');
        if ($('html').hasClass('device-ios, device-android')) {
            $('html').removeClass('device-ios, device-android');
        }
    } else {
        if (sUsrAg.match(/Android/i)) {
            $('html').addClass('device-android');
            if ($('html').hasClass('device-web, device-ios')) {
                $('html').removeClass('device-web, device-ios');
            }
            $('html').addClass('device-android').addClass('device-app');

        } else if (sUsrAg.match(/iPhone|iPad|iPod/i)) {
            $('html').addClass('device-ios');
            if ($('html').hasClass('device-web, device-android')) {
                $('html').removeClass('device-web, device-android');
            }
            $('html').addClass('is-ios').addClass('is-app');

            $('.input-text, textarea').bind('focus', function () {
                $('body').addClass('opened-keyboard');
            });
            $('.input-text, textarea').bind('blur', function () {
                $('body').removeClass('opened-keyboard');
            });
        }
    }
};

function fnGetBrowserInfo(){
    var userAgent = navigator.userAgent;
    var browserName = "UNKNOWN";
    var browserVersion = -1;
    try{
        if(userAgent.indexOf("MSIE") > -1){
            browserName = "IE";
            var _version = userAgent.substring(userAgent.indexOf("MSIE")+5);
            _version = _version.substring(0, _version.indexOf("."));
            browserVersion = parseInt(_version);
        }else{
            if(userAgent.indexOf("Trident") > -1) {
                browserName = "IE";
                var _version = userAgent.substring(userAgent.indexOf("rv:")+3);
                _version = _version.substring(0, _version.indexOf("."));
                browserVersion = parseInt(_version);
            }else if(userAgent.indexOf("Opera") > -1){
                browserName = "Opera";
                var _version = userAgent.substring(userAgent.indexOf("Version")+8);
                _version = _version.substring(0, _version.indexOf("."));
                browserVersion = parseInt(_version);
            }else if(userAgent.indexOf("OPR") > -1){
                browserName = "Opera";
                var _version = userAgent.substring(userAgent.indexOf("OPR")+4);
                _version = _version.substring(0, _version.indexOf("."));
                browserVersion = parseInt(_version);
            }else if (userAgent.indexOf("Firefox") > -1) {
                browserName = "Firefox";
                var _version = userAgent.substring(userAgent.indexOf("Firefox")+8);
                _version = _version.substring(0, _version.indexOf("."));
                browserVersion = parseInt(_version);
            }else if(userAgent.indexOf("Safari") > -1){
                if (userAgent.indexOf("Chrome") > -1) {
                    browserName = "Chrome";
                    var _version = userAgent.substring(userAgent.indexOf("Chrome")+7);
                    _version = _version.substring(0, _version.indexOf("."));
                    browserVersion = parseInt(_version);
                }else{
                    browserName = "Safari";
                    var _version = userAgent.substring(userAgent.indexOf("Version")+8);
                    _version = _version.substring(0, _version.indexOf("."));
                    browserVersion = parseInt(_version);
                }
            }
        }
    }catch(e){
        console.debug(e+"\n\n"+userAgent);
    }
    return {"browserName" : browserName, "browserVersion" : browserVersion};
}

function MakeSignDataPop(msg , signOpt, callback ){
    $('#dscertContainer').hide();
    
    $.blockUI({
        message:'<div><div><img src="' + mlDirPath + 'UI/images/loader.gif" alt="로딩중입니다."/></div><p style="display:inline-block; padding-top:4px; font-size:11px; color:#333; font-weight:bold;">잠시만 기다려 주세요.</p></div>',
        css:{left:(($(window).width()/2)-75)+'px'}
    });
    
    magicline.uiapi.ML_funProcInitCheck(function(code,data){
        if( code == 0 ){
            magicline.uiapi.completeInit();
            magicline.uiapi.MakeSignData(msg, signOpt, callback);
           // if(typeof(checkCallback) == "function"){
           //     magicline.uiapi.checkInstall(checkCallback);
           // }
        }
    });
    
    //magicline.uiapi.ML_checkInit();
    //setTimeout(function(){
    //    if( magicline.is_ML_Sign_Init ){
    //        magicline.uiapi.MakeSignData(msg, signOpt, callback);
    //    }else{
            // ML_checkInit();
    //    }
    //},1500);
}

function MakeSignDataPopPre(msg , signOpt, callback) {
    
    if(!findLoginConf(PKI_LOGIN_CONF_CODE)){
        return false;
    }
    
    if("PC" === DEVICE) {
         // 포커스인풋 박스 쿠키 설정
        // $.cookie("cookieFocusCheck", "Certificate", {path: "/", domain: location.hostname, expires : 30 });
        $.cookie("cookieFocusCheck", "Certificate", {path: "/", domain: ".hycu.ac.kr", expires : 30});
        
        MakeSignDataPop(msg , signOpt, callback);
    } else { 
       fnOpenAlertPopup.alert('알림', '모바일(또는 테블릿)에서는 공동인증 로그인 지원하지 않습니다.<br>다른 학습로그인(카카오, 간편번호, 생체인증)을 이용해 주세요.', function (res) {
           if (res) {     
           }
       });
    }
}

function MakeSignDataDelPop( msg , signOpt, callback ){
    
    if(!findLoginConf(PKI_LOGIN_CONF_CODE)){
        return false;
    }
    
    $('#dscertContainer').hide();
    
    $.blockUI({
        message:'<div><div><img src="' + mlDirPath + 'UI/images/loader.gif" alt="로딩중입니다."/></div><p style="display:inline-block; padding-top:4px; font-size:11px; color:#333; font-weight:bold;">잠시만 기다려 주세요.</p></div>',
        css:{left:(($(window).width()/2)-75)+'px'}
    });
    
    magicline.uiapi.ML_funProcInitCheck(function(code,data){
        if( code == 0 ){
            magicline.uiapi.completeInit();
            
            magicline.uiapi.MakeSignData(msg, signOpt, callback);
           // if(typeof(checkCallback) == "function"){
           //     magicline.uiapi.checkInstall(checkCallback);
           // }
        }
    });
    
    //magicline.uiapi.ML_checkInit();
    //setTimeout(function(){
    //    if( magicline.is_ML_Sign_Init ){
    //        magicline.uiapi.MakeSignData(msg, signOpt, callback);
    //    }else{
            // ML_checkInit();
    //    }
    //},1500);
}

var kakaoInterval;

// 카카오 로그인 함수
function fnLoginKakao(formName){

    if(!findLoginConf(KAKAO_LOGIN_CONF_CODE)){
        return false;
    }
    
    var from = document.getElementById(formName);
    
    if(fnCheckUserInfo($("#loginIdKakao"), $("#loginPwdKakao"), 'none', 'none', 'kakao', true)){
    
        // 포커스인풋 박스 쿠키 설정
        // $.cookie("cookieFocusCheck", "Kakao", {path: "/", domain: location.hostname, expires : 30 });
        $.cookie("cookieFocusCheck", "Kakao", {path: "/", domain: ".hycu.ac.kr", expires : 30});
        
        // if($("input[id=cookieLoginCheckKakao]").is(":checked")){
        //     // 쿠키 설정
        //     $.cookie("cookieLoginCheckKakao", "Y", {path: "/", domain: location.hostname, expires : 30 });
        //     $.cookie("loginId", $("#loginIdKakao").val(), {path: "/", domain: location.hostname, expires : 30});
        // } else {
        //     $.cookie("cookieLoginCheckKakao", "N", {path: "/", domain: location.hostname, expires : 30});
        // }

        $.cookie("cookieLoginCheckKakao", "Y", {path: "/", domain: location.hostname, expires : 30});
        $.cookie("loginId", $("#loginIdKakao").val(), {path: "/", domain: location.hostname, expires : 30});
        
        // $('#reqKakaoAuthBtn').css('display', 'none'); // 카카오 인증버튼 비활성화
        $('#reqKakaoAuthBtn').css('display', 'inline-block');
        $("#popup_kakao").css('display', 'flex').focus();
 
        // 애플사 기기 뿐만 아니라, 모든 기기에서 카카오 인증 수동처리로 변경되어서 주석 처리
        // if ((navigator.userAgent.indexOf('iPhone') == -1)
        //         && (navigator.userAgent.indexOf('iPod') == -1)
        //         && (navigator.userAgent.indexOf('iPad') == -1)
        //         && (navigator.userAgent.indexOf('Macintosh') == -1)) {
        //
        //     setInterval(function(){
        //         kakaoInterval = fnSettingTimer($('#kakaoAuthTime'));
        //     }, 200);
        //
        //     setTimeout(function(){
        //         from.submit();
        //     },500);
        // }else{
            //애플사 기기의 경우 카카오 인증 수동처리
            var params = {};
            params.persNo = $('#loginIdKakao').val();
            params.pswd = $('#loginPwdKakao').val();
            $.ajax({
              url : HYCU_SSO_FIDO_URL+"/com/KcerCtr/loginRequest.do",
              data : params,
              type : 'post',
              dataType : 'json',
              async : false,
              success : function(rslt) {
                  const txId = rslt.txId;
                  const status = rslt.status;
                  
                  if(status == 'SUCCESS'){
                      if(!fnCheckValid(txId)){
                          fnOpenAlertPopup.alert('알림', '카카오 인증 요청에 실패하였습니다.<br>'+
                                   '잠시 후 다시 시도해 주세요.', function (res) {
                               if (res) {   
                                   location.reload();
                               }
                           });
                          return false;
                      }
                      
                      $('#txId').val(rslt.txId);
                      $('#reqKakaoAuthBtn').css('display', 'inline-block'); // 카카오 인증버튼 활성화
                  }else{
                      // 실패
                      fnKakaoErrorMsg(rslt.errCode);
                  }
                 
              }, error : function(requst, status) {
                   fnOpenAlertPopup.alert('알림', '카카오 인증 요청에 실패하였습니다.<br>'+
                           '잠시 후 다시 시도해 주세요.', function (res) {
                       if (res) { 
                           location.reload();
                       }
                   });
                }
            });         
        }    
    // }
}

// 일반 로그인 함수
function fnLoginCom(formName){

    if(fnCheckUserInfo($("#loginIdCom"), $("#loginPwdCom"), 'none', 'none', 'com', true)){

        // 직원/조교는 외부망에서 접근 시, 알림 창 표시
        if (checkIP("com") === "false") {
            fnOpenAlertPopup.alert('알림',
                '교내 지정된 IP가 아닌 곳에서 접속하는 경우 학습로그인(카카오, 생체, 간편번호)으로 로그인해주시기 바랍니다.',
                function (res) {
                    if (res) {
                    }
                });
            return false;
        }else{

             // 포커스인풋 박스 쿠키 설정
            // $.cookie("cookieFocusCheck", "Normal", {path: "/", domain: location.hostname, expires : 30 });
             $.cookie("cookieFocusCheck", "Normal", {path: "/", domain: ".hycu.ac.kr", expires : 30});

            if($("input[id=cookieLoginCheckKakao]").is(":checked")){
                // 쿠키 설정
                $.cookie("cookieLoginCheckKakao", "Y", {path: "/", domain: location.hostname, expires : 30 });
                $.cookie("loginId", $("#loginIdCom").val(), {path: "/", domain: location.hostname, expires : 30});
            } else {
                $.cookie("cookieLoginCheckKakao", "N", {path: "/", domain: location.hostname, expires : 30});
            }

            var form = document.getElementById('loginFormCom');
            form.action = "/sso/AuthCtr/createRequestAuth.do";
            form.submit();
        }
    }
}

// 외부망 2차 인증 로그인
function fnLoginMfa(formName) {

    // 아이디 패스워드 체크
    if (fnCheckUserInfo($("#loginIdMfa"), $("#loginPwdMfa"), 'none', 'none',
        'com', true)) {

        if ($("#mfaGubun").val() === 'pin') { // 간편번호 로그인으로 들어온 경우
            document.loginFormPin.submit();
        } else if ($("#mfaGubun").val() === 'fido') { // 생체인증 로그인으로 들어온 경우
            $("#sessionForm").submit();
        } else if ($("#mfaGubun").val() === 'pki') { // 공동인증서 로그인으로 들어온 경우
            document.reqForm.submit();
        }

        if($("input[id=cookieLoginCheckMfa]").is(":checked")){
            // 쿠키 설정
            $.cookie("cookieLoginCheckMfa", "Y", {path: "/", domain: location.hostname, expires : 30 });
            $.cookie("loginIdMfa",   $("#loginIdMfa").val(), {path: "/", domain: location.hostname, expires : 30});
        } else {
            $.cookie("cookieLoginCheckMfa", "N", {path: "/", domain: location.hostname, expires : 30});
        }
    }
}

// 공동인증 콜백 함수
function mlCallBack(code, message){

    if(code==0){
        // 정상메시지
        var data = encodeURIComponent(message.encMsg);

        document.reqForm.signedData.value = data;

        if(message.vidRandom != null){
            document.reqForm.vidRandom.value = encodeURIComponent(message.vidRandom);
        } 
        
        let params = {};
         
        params.signedData = $('#signedData').val();
        params.vidRandom = $('#vidRandom').val();
        params.idn = $('idn').val();

        // 사전 검증!
        $.ajax({
              url : '/sso/AuthCtr/createRequestPreAuthPKI.do',
              data : params,
              type : 'post',
              dataType : 'json',
              async : false,
              success : function(rslt) {
                  const pkiUserIdList = rslt.pkiUserIdList;
                  const msgCode = rslt.errorCode;
                  
                  $('#pkiUserIdList').empty();
                  $('#popup_pki').find('.head-title').text('공동인증서 로그인');

                  let html = "";
                   
                  if(fnCheckValid(msgCode)){
                      fnPKIAuthMsg(msgCode);
                  }else if(fnCheckValid(pkiUserIdList)){
                      const size = pkiUserIdList.length;
                       
                      if(size == 1){
                          $('#pkiUserId').val(pkiUserIdList[0].persNo);

                          // 직원, 조교가 외부망에서 접속 시
                          // 공동인증
                          if (checkIP("pki") === "false") {
                              // MFA gubun 변경
                              $("#mfaGubun").val("pki"); // 공동인증

                              // 팝업을 표시하고 완료 버튼 클릭을 기다림
                              $("#popup_mfa").css('display',
                                  'flex').focus();
                              // $("#loginIdMfa").val(pkiUserIdList[0].persNo); // 팝업 내에 학번저장 기능 추가(2025-09-01)
                              // $("#loginPwdMfa").focus();

                          } else {
                              // 교수, 학생인 경우 외부망 체크 skip
                              document.reqForm.submit();
                          }


                      }else{
                          html += '<p>로그인 하실 학번을 선택해주세요.</p>';
                          html += '<div class="dl_wrap03 scroll_box">';
                          html += '<div class="col_box">';
                            
                          for(let i = 0; i < size; i++){                           
                              html += '<button class="btn_point btn" type="button" onclick="javascript:fnLoginPKI(\''+pkiUserIdList[i].persNo +'\');">';
                              html += '<span>' + pkiUserIdList[i].persNo + '</span>'; 
                              html += '<span>' + pkiUserIdList[i].deptNm + '</span>';
                              html += '</button>';
                          }
                          html += '</div>'; 
                          html += '</div>'; 

                         $('#pkiUserIdList').append(html);
                         $("#popup_pki").css('display', 'flex').focus();
                      }           
                  }else{
                      fnOpenAlertPopup.alert('알림', '등록된 공동인증서가 존재하지 않습니다.<br>'+
                             '인증서를 등록 후 이용해 주세요.', function (res) {
                          if (res) { 
                               location.reload();
                          }
                      });
                  }
              }, error : function(requst, status) {
                   fnOpenAlertPopup.alert('알림', '공동인증서 검증 요청에 실패하였습니다.<br>'+
                           '잠시 후 다시 시도해 주세요.', function (res) {
                       if (res) { 
                           location.reload();
                       }
                   });
              }, complete : function(){
                  fnLodingClose();
              }
        });         
    }else{
        fnLodingClose();
        fnOpenAlertPopup.alert('알림', '공동 인증 중 오류가 발생하였습니다.<br>'+
                '담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
                '에러코드:콜백 함수 에러', function (res) {
            if (res) {      
            }
        });
        return;
    }
}

function fnLoginPKI(pkiUserId){    
    $('#pkiUserId').val(pkiUserId);
    // 직원, 조교가 외부망에서 접속 시
    if (checkIP("pki") === "false") {
        // MFA gubun 변경
        $("#mfaGubun").val("pki"); // 공동인증

        // 팝업을 표시하고 완료 버튼 클릭을 기다림
        $("#popup_mfa").css('display',
            'flex').focus();
        // $("#loginIdMfa").val(pkiUserId); // 팝업 내에 학번저장 기능 추가(2025-09-01)
        // $("#loginPwdMfa").focus();

    } else {
        // 교수, 학생인 경우 외부망 체크 skip
        document.reqForm.submit();
    }
}

// 공동인증 삭제 콜백 함수
function mlDelCallBack(code, message){
    
    if(code==0){
        // 정상메시지
        var data = encodeURIComponent(message.encMsg);

        document.reqForm.signedData.value = data;

        if(message.vidRandom != null){
            document.reqForm.vidRandom.value = encodeURIComponent(message.vidRandom);
        } 

        let params = {};
        
        params.signedData = $('#signedData').val();
        params.vidRandom = $('#vidRandom').val();
        params.idn = $('idn').val();
        
        // 사전 검증!
        $.ajax({
              url : '/sso/AuthCtr/createRequestPreAuthDelPKI.do',
              data : params,
              type : 'post',
              dataType : 'json',
              async : false,
              success : function(rslt) {
                  const pkiUserIdList = rslt.pkiUserIdList;
                  const cn = rslt.cn;
                  const msgCode = rslt.msgCode;
                  
                  $('#pkiUserIdList').empty();
                  $('#popup_pki').find('.head-title').text('공동인증서 삭제');

                   let html = "";
                   
                   if(fnCheckValid(msgCode)){
                       fnPKIDelMsg(msgCode);
                   }else if(fnCheckValid(pkiUserIdList)){
                       const size = pkiUserIdList.length;
                       
                       if(size == 1){
                           fnDelPKI(pkiUserIdList[0].persNo, cn);
                       }else{
      
                           html += '<p>삭제할 학번을 선택해 주세요.</p>';
                           html += '<div class="dl_wrap03">';
                           html += '<div class="col_box">';
                           
                           for(let i = 0; i < size; i++){
                               
                               html += '<div class="radio_wrap ">';
                               
                               if(i == 0){                         
                                   html += '<input type="radio" id="'+ i +'" name="pkiUserId" value="' + pkiUserIdList[i].persNo + '" checked="checked"/>';                      
                               }else{
                                   html += '<input type="radio" id="'+ i +'" name="pkiUserId" value="' + pkiUserIdList[i].persNo + '" />';
                               }
                               html += '<label for="' + i + '"><span>' + pkiUserIdList[i].persNo + ' ('+ pkiUserIdList[i].deptNm + ')</span></label>';
                               html += '</div>';
                           }
                           html += '</div>'; 
                           html += '</div>'; 
                           html += '<div class="dl_col send_btn">'; 
                           html += '<button type="button" class="btn btn_normal btn_code3" onclick="javascript:fnDelPKI(\'none\', \''+cn+'\');">삭제</button>'; 
    
                           $('#pkiUserIdList').append(html);
                           $("#popup_pki").css('display', 'flex').focus();
                       }           
                   }else{
                       fnOpenAlertPopup.alert('알림', '등록된 공동인증서가 존재하지 않습니다.<br>'+
                               '인증서를 등록 후 이용해 주세요.', function (res) {
                           if (res) { 
                               location.reload();
                           }
                       });
                   }
              }, error : function(requst, status) {
                   fnOpenAlertPopup.alert('알림', '공동인증서 검증 요청에 실패하였습니다.<br>'+
                           '잠시 후 다시 시도해 주세요.', function (res) {
                       if (res) { 
                           location.reload();
                       }
                   });
              }, complete : function(){
                  fnLodingClose();
              }
        });         
    }else{
        fnOpenAlertPopup.alert('알림', '공동 인증 삭제 처리중 오류가 발생하였습니다.<br>'+
                '담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
                '에러코드: 삭제 콜백 함수 에러', function (res) {
            if (res) {      
            }
        });
    }
}

function fnDelPKI(userId, cn){
    
    if(userId == 'none'){
        $("#popup_pki").css('display', 'none');
        userId = $('input[name="pkiUserId"]:checked').val();
    }
    
    fnLodingOpen();
    
    let params = {};
    params.pkiUserId = userId;
    params.cn = cn;
    
    $.ajax({
        url : '/sso/AuthCtr/createRequestAuthDelPKI.do',
        data : params,
        type : 'post',
        dataType : 'json',
        async : false,
        success : function(rslt){
            fnPKIDelMsg(rslt.msgCode);
        },
        error : function(){
            fnOpenAlertPopup.alert('알림', '공동 인증 삭제 처리중 오류가 발생하였습니다.<br>'+
                    '담당자(02-2290-0207)에게 문의 부탁드립니다.', function (res) {
                if (res) {      
                }
            });
        },
        complete : function(){
            fnLodingClose();
        }
    });
}
    
//아이폰 사파리 브라우저 미안내 차단의 이유로 팝업창 변경작업 CSR_20170628110239_0
//정기 PM 서버 작업 MSG 구분 추가 //v.2.1 
function MM_openBrWindow(theURL,winName,features) { //v2.0 //v.2.1
    if (theURL =="alert")
    {
        fnOpenAlertPopup.alert('알림', '일시적인 오류가 발생했습니다. 재시도 부탁드립니다.', function (res) {
            if (res) {      
            }
        });
        return false;   
    }
    if (theURL !="")
    {
        if (/iP(ad|od|hone)/i.test(window.navigator.userAgent) && /WebKit/i.test(window.navigator.userAgent) && !(/(CriOS|FxiOS|OPiOS|mercury)/i.test(window.navigator.userAgent)))
        { //IOS + 사파리라면
          var popup_YNchk = window.open(theURL,winName,features);
          if(popup_YNchk == null) {
              fnOpenAlertPopup.alert('알림', '팝업이 차단되어 있습니다.\n설정 > Safari에서 팝업차단을 해지하신 후에 다시 시도해 주세요.', function (res) {
                  if (res) {      
                  }
              });
              return false; 
          }
        }
        else
        {
              window.open(theURL,winName,features);
        }
    }
    else{
    //commonPopupMsg('서비스 준비중입니다.\n\n서비스 중지 기간 : 2017. 08.11(금) 19:00 ~ 8.16(수) 09:00');
    }
}

// 카카오인증 처리완료 함수
function fnClear(){
    
}

// 로딩 마스크
function LoadingWithMask() {
    //화면의 높이와 너비를 구합니다.
    var maskHeight = $(document).height();
    var maskWidth  = window.document.body.clientWidth;
     
    //화면에 출력할 마스크를 설정해줍니다.
    var mask       ="<div id='mask' style='position:absolute; z-index:9000; background-color:#000000; display:none; left:0; top:0;'></div>";
    var loadingImg ='';
      
    loadingImg +="<div id='loadingImg'>";
    loadingImg +=" <img src='LoadingImg.gif' style='position: relative; display: block; margin: 0px auto;'/>";
    loadingImg +="</div>"; 
  
    // 화면에 레이어 추가
    $('body')
        .append(mask)
        .append(loadingImg)
        
    //마스크의 높이와 너비를 화면 것으로 만들어 전체 화면을 채웁니다.
    $('#mask').css({
            'width' : maskWidth
            ,'height': maskHeight
            ,'opacity' :'0.3'
    });
  
    //마스크 표시
    $('#mask').show();  
  
    //로딩중 이미지 표시
    $('#loadingImg').show();
}

function closeLoadingWithMask() {
    $('#mask, #loadingImg').hide();
    $('#mask, #loadingImg').remove(); 
}

function fnSuccess(inType, inRelayState, inSAMLRequest, inAuthParameter){
    if(inType == 'Def'){
        $("#RelayState").val(inRelayState);
        $("#SAMLRequest").val(inSAMLRequest);
        $("#authParameter").val(inAuthParameter);  
        $("#successForm").submit();
        
    } else if(inType == ''){
        
    } else if(inType == ''){
        
    } else if(inType == ''){
        
    }
    
}

function fnError(inType, inErrorCode, inMessage){
    if(inType == 'Def'){
        fnOpenAlertPopup.alert('알림', inMessage, function (res) {
            if (res) {      
            }
        });
    } else if(inType == ''){
        
    } else if(inType == ''){
        
    } else if(inType == ''){
        
    }
}


// 파이도 QR코드인증 안내
function fnFidoInfo(){  
    layer_popup($("#divFidoInfo"));
}

// 공동인증서 안내
function fnPKIInfo(){
    window.open('/sso/ManualCtr/certInfo.do','공동인증서 안내','width=1000,height=800,status=no,scrollbars=yes');
}

// 공동인증서 FAQ
function fnPKIFaq(){
    layer_popup($("#divPIFaq"));
}

// 카카오 동의
function fnKakaoAgree(){
//    layer_popup($("#divKakaoAgree"));
    fnOpenAlertPopup.createCloseBtn();
    fnOpenAlertPopup.changeConfirmBtnNm('동의', '비동의');
    fnOpenAlertPopup.confirm('제3자 정보 제공 약관', '본교는 학우님의 개인 정보를 보호하고, 학생 신분 확인 및 대리 수강(시험)등의 부정행위방지를 위해 본인인증 로그인을 서비스하고 있습니다. 좀 더 편리한 본인인증 서비스를 제공하고자 (주)카카오를 통한 카카오 인증을 하고 있습니다. 본 동의를 거부하실 권리가 있으며 동의를 거부하실 경우 서비스 이용이 제한 될 수 있습니다.<br><br> - 제공받는 자 : (주) 카카오<br>- 수집항목 : 이름, 생년월일, 휴대폰번호, 성별<br>- 수집이용목적 : 본인인증', function (res) {
        if (res) {
             $('#personalAggrCheck').prop('checked',true).focus();
        }else{
            $('#personalAggrCheck').prop('checked',false).focus();
        }
    });
}

// 카카오 내용
function fnKakaoInfo(){
    //layer_popup($("#divKakaoInfo"));
    window.open('/sso/ManualCtr/kkoInfo.do?tab=3','카카오 안내','width=1000,height=800,status=no,scrollbars=yes');
}


// 레이어 팝업 함수
function layer_popup(el){

    var $el = $(el);        //레이어의 id를 $el 변수에 저장
    var isDim = $el.prev().hasClass('dimBg');   //dimmed 레이어를 감지하기 위한 boolean 변수
    isDim ? $('.dim-layer').fadeIn() : $el.fadeIn();
    var $elWidth = ~~($el.outerWidth()),
        $elHeight = ~~($el.outerHeight()),
        docWidth = $(document).width(),
        docHeight = $(document).height();

    // 화면의 중앙에 레이어를 띄운다.
    if ($elHeight < docHeight || $elWidth < docWidth) {
        $el.css({
            marginTop: -$elHeight /2,
            marginLeft: -$elWidth/2
        })
    } else {
        $el.css({top: 0, left: 0});
    }
    
    $el.find('a.btn-layerClose').focus(); // 21.05.27 웹접근성보완 - 레이어팝업 호출 후 포커스 지정

    $el.find('a.btn-layerClose').click(function(){
        isDim ? $('.dim-layer').fadeOut() : $el.fadeOut(); // 닫기 버튼을 클릭하면 레이어가 닫힌다.
        // 21.05.28 웹접근성 보완 - 팝업close후 포커스 지정
        if(el.selector == "#divKakaoAgree"){ // 개인정보이용동의 안내 팝업인경우
            $("#kakaoAgreeBtn").focus();
        }
        
        return false;
    });

    $('.layer .dimBg').click(function(){
        $('.dim-layer').fadeOut();
        return false;
    });

}

function authReadyPre() {

    if(!findLoginConf(FIDO_LOGIN_CONF_CODE)){
        return false;
    }
    
    /*
    //IOS에서 생체로그인 못하도록 임시조치
    if(IOS_APP_YN == 'Y'){
        alert('생체인증 서비스 점검 중입니다.\n간편번호 인증으로 학습로그인해 주세요.');
        return false;
    }
    */
    
    if(DEVICE == 'PC' && fnIsTablet() == false) {
        authReady();
    }else if(DEVICE.indexOf("APP") != -1){
        //  생체인증 사용 확인 (1)
         getCheckBiometric();
      }else if(DEVICE == 'MOBILE_WEB' || fnIsTablet() == true){ // 모바일 웹일 경우
          
        fnOpenAlertPopup.confirm('알림', '한사대로 앱을 이용하시면 생체인증이 가능합니다.<br>'+
                '앱으로 이동하시겠습니까?', function (res) {
            if (res) {
                var userAgent = navigator.userAgent;
                var visiteTm = ( new Date() ).getTime();
                if(userAgent.match(".*Android.*") || userAgent.match(".*android.*")){
//                어플 learningX 접속 시 userAgent: candroid
                    //웹-안드로이드폰
                    // 앱이 있으면 앱 실행, 없으면 마켓 이동
                    location.href = 'intent://hycu#Intent;scheme=smartq;package=com.squarenet.smartq.hycu;end';      
                }else if(userAgent.match(".*iPhone.*") || userAgent.match(".*iPad.*") || fnIsTablet() == true){
                    //웹-아이폰
                    setTimeout( function () {
                       location.href = "https://itunes.apple.com/app/id1526780589";                        
                    } ,0 );
                }
            }
        });
     }
}

//엔터키 이벤트 교체작업
/*function enterkeyDef(){     
    if (window.event.keyCode == 13) {
        // 엔터키가 눌렸을 때 실행할 내용
        fnLoginCom('loginFormCom');
   } 
}*/

// 로그인을 시도하는 교직원(직원/조교)이 접속한 IP의 교내 IP여부 return
// 2021.04.18. 정준희. 추가
function checkIP(gubun) {
    var params = {};
    var result = "false";

    // gubun에 따른 분기 처리
    if (gubun === 'com') { // 일반로그인
        params.userId = $('#loginIdCom').val();
    } else if (gubun === 'fido') { // 생체인증
        params.userId = $("#userId").val();
    } else if (gubun === 'pki') { // 공동인증
        params.userId = $('#pkiUserId').val();
    } else if (gubun === 'pin') { // 간편번호
        params.userId = '';
    }
    $.ajax({
        url : "/sso/LoginCtr/checkInside.do",
        data : params,
        type : 'post',
        dataType : 'json',
        async : false,
        success : function(rslt) {
            var availIp = rslt.availIp;
           
            if(!!availIp && !isNaN(availIp)) {
                if(Number(availIp) >= 1) {
                    result = "true";
                } else {
                    result = "false";
                }
            } else {
                result = "false";
            }
        }, error : function(requst, status) {
            fnOpenAlertPopup.alert('알림', status, function (res) {
                if (res) {      
                }
            });
        }
    });
    return result;
}

function checkLoginConf(){

    // 공동인증서 점검 여부 확인
    if(PKI_LOGIN_CONF_MSG.length > 0){
        $('#container .tab .form_list .form_item.certificate').addClass('inspection');
        $('#pkiCoverBox .desc').html(PKI_LOGIN_CONF_MSG);
    }
    
    // 생체인증 점검 여부 확인
    if(FIOD_LOGIN_CONF_MSG.length > 0){
        $('#container .tab .form_list .form_item.living').addClass('inspection');
        $('#fidoCoverBox .desc').html(FIOD_LOGIN_CONF_MSG);
    }
    
    // 카카오 점검 여부 확인
    if(KAKAO_LOGIN_CONF_MSG.length > 0){
        $('#container .tab .form_list .form_item.kakao').addClass('inspection');
        $('#kakaoCoverBox .desc').html(KAKAO_LOGIN_CONF_MSG);
    }
    
    // 카카오 로그인 IOS APP 버전체크 (한희 선생님 요청으로 주석처리 2023.11.14)
    /*else if (IOS_APP_YN == 'Y' && getHycuAppVersion() < 131){
        var title = "카카오 인증 사용 안내"; 
        var txt = "앱스토에서 한사대로 앱을 최신 버전으로 업데이트 하신 후 사용해주세요.";
        
        $('#container .tab .form_list .form_item.kakao').addClass('inspection');
        $('#kakaoCoverBox .title').html(title);
        $('#kakaoCoverBox .desc').html(txt);
    }*/
    
    // 간편번호 점검 여부 확인
    if(PIN_LOGIN_CONF_MSG.length > 0){
        $('#container .tab .form_list .form_item.easy').addClass('inspection');
        $('#pinCoverBox .desc').html(PIN_LOGIN_CONF_MSG);
    }
    
}

function findLoginConf(loginGbn, type){
    let params = {};
    let ret = true;
 
    params.loginGbn = loginGbn;
    $.ajax({
        url : "/sso/LoginCtr/findLoginConf.do",
        data : params,
        type : 'post',
        dataType : 'json',
        async : false,
        success : function(rslt) {
            
            const errMsg = rslt.errMsg;

            if(fnCheckValid(errMsg)){    

                if(!type){
                    if(PKI_LOGIN_CONF_CODE == loginGbn){
                         fnOpenAlertPopup.alert('시스템 점검 안내', errMsg, function (res) {
                             if (res) {                      
                                $('#container .tab .form_list .form_item.certificate').addClass('inspection');
                                $('#pkiCoverBox .desc').html(errMsg);
                             }
                         }); 
                    }else if(FIDO_LOGIN_CONF_CODE == loginGbn){
                         fnOpenAlertPopup.alert('시스템 점검 안내', errMsg, function (res) {
                             if (res) {                                         
                                $('#container .tab .form_list .form_item.living').addClass('inspection');
                                $('#fidoCoverBox .desc').html(errMsg);
                             }
                         }); 
                    }else if(KAKAO_LOGIN_CONF_CODE == loginGbn){
                         fnOpenAlertPopup.alert('시스템 점검 안내', errMsg, function (res) {
                             if (res) {                      
                                $('#container .tab .form_list .form_item.kakao').addClass('inspection');
                                $('#kakaoCoverBox .desc').html(errMsg); 
                             }
                         });       
                    }else if(PIN_LOGIN_CONF_CODE == loginGbn){
                         fnOpenAlertPopup.alert('시스템 점검 안내', errMsg, function (res) {
                             if (res) {                      
                                $('#container .tab .form_list .form_item.easy').addClass('inspection');
                                $('#pinCoverBox .desc').html(errMsg); 
                             }
                         });       
                    }
                }
                
               ret = false;
            }
        }, error : function(requst,status) {
            fnOpenAlertPopup.alert('안내', '기기의 네트워크 연결이 원활하지 않습니다.', function (res) {
                   if (res) {                        
                   }
               });  
        }
    });
    return ret;
}

function fnTabAuth(gubun_find, gubun_auth, element){
    if(gubun_find === "findId"){
        $('#findId a').each(function(idx, elem){
            $(elem).removeClass('checked');
        });
        $(element).addClass('checked');
        
        if(gubun_auth === "phoneAuth"){
            $('#wrapPhoneAuthForFindId').show();
            $('#wrapEmailAuthForFindId').hide();
            
            $('.sId_find_wrap .sId_item').removeClass('active');
            $('#wrapPhoneAuthForFindId').parents('li').addClass('active');
        }
        else if(gubun_auth === "emailAuth"){
            $('#wrapEmailAuthForFindId').show();
            $('#wrapPhoneAuthForFindId').hide();
            
            $('.sId_find_wrap .sId_item').removeClass('active');
            $('#wrapEmailAuthForFindId').parents('li').addClass('active');
        }
    }
    else if(gubun_find === "findPw"){
        $('#findPw a').each(function(idx, elem){
            $(elem).removeClass('checked');
        });
        $(element).addClass('checked');
        
        if(gubun_auth === "phoneAuth"){
            $('#wrapPhoneAuthForFindPw').show();
            $('#wrapEmailAuthForFindPw').hide();
            
            $('.sId_find_wrap .sId_item').removeClass('active');
            $('#wrapPhoneAuthForFindPw').parents('li').addClass('active');
        }
        else if(gubun_auth === "emailAuth"){
            $('#wrapEmailAuthForFindPw').show();
            $('#wrapPhoneAuthForFindPw').hide();
            
            $('.sId_find_wrap .sId_item').removeClass('active');
            $('#wrapEmailAuthForFindPw').parents('li').addClass('active');
        }
    }
}

function fnSelfAuth(gubun_find, gubun_auth){
    
    if(gubun_auth === "phoneAuth"){
        
        var params = {};
        
        if(gubun_find === "findId"){    // 핸드폰 본인인증으로 학번/사번 찾기           
            params.gubun = 'findId';
            fnPhoneAuth(params);  
            
        }else if(gubun_find === "findPw"){    // 핸드폰 본인인증으로 비밀번호 찾기
          
            let userId = $('#userIdForFindPw').val();
            
            if(fnCheckUserInfo($('#userIdForFindPw'), 'none', 'none', 'none', 'findPwPhoneAuth', true)){
                params.gubun = 'findPw';
                params.userId = userId;
                fnPhoneAuth(params); 
            }
        }
    }
    else if(gubun_auth === "userInfoAuth"){
        
        if(gubun_find === "findId"){

            if(fnCheckUserInfo('none', 'none', $('#userNameForFindId'), $('#userBirthForFindId'), 'finId', false)){
                
                const name = $('#userNameForFindId').val();
                const birthDay = $('#userBirthForFindId').val();
                const gender = $('input[name="genderForFindId"]:checked').val();
                const userGbn = $('input[name="idCateForFindId"]:checked').val();
                
                fnLodingOpen();
                
                $.ajax({
                    url: "/sso/MyCertCtr/findEmailAndPersNo.do",
                    type: "POST",
                    data: {
                        name: name,
                        birthDay: birthDay,
                        userGbn: userGbn,
                        gender: gender
                    },
                    dataType: "json",
                    success: function(data){
           
                        if(data.list != null && data.list != undefined && data.list.length != 0){

                            $('#emailListForFindId').empty();
                            $('#emailListForFindPw').empty();
                            
                            let html = "";
                            const size = data.list.length;
                                          
                            html += '<p class="box_title">인증코드 발송</p>';
                            html += '<div class="dl_wrap03">';
                            html += '<div class="email_send_box">';
                            html += '<div class="email_list">';
                            html += '<div class="col_box">';
                            
                            for(let i = 0; i < size; i++){
                                html += '<div class="radio_wrap ">';
                                if(i === 0){                         
                                    html += '<input type="radio" id="'+ data.list[i].persNo +'" name="selectEmailForSendCode" value="' + data.list[i].email + '" checked="checked"/>';                      
                                }else{
                                    html += '<input type="radio" id="'+ data.list[i].persNo +'" name="selectEmailForSendCode" value="' + data.list[i].email + '" />';
                                }
                                html += '<label for="' + data.list[i].persNo + '"><span>' + data.list[i].maskingEmail + '</span></label>';
                                html += '</div>';
                            }
                            html += '</div>'; 
                            html += '</div>'; 
                            html += '<div class="dl_col email_send_btn">'; 
                            html += '<button type="button" class="btn btn_normal btn_code3" onclick="javascript:fnSendEmailCode(\''+gubun_find+'\');">인증코드 발송</button>'; 
                            html += '</div>'; 
                            html += '</div>'; 
                            html += '</div>'; 

                            $('#emailListForFindId').append(html);
                            $('#userInfoAuthForFindId').hide();
                            $('#sendEmailCodeForFindId').show();

                        }else{
                            fnOpenAlertPopup.alert('알림', '일치하는 학번정보가 없거나,<br>'+
                                    '개인이메일 주소가 미등록 계정입니다.', function (res) {
                                if (res) {    
                                    $('#userNameForFindId').focus();
                                }
                            });
                            return false;   
                        }
                    },
                    error: function(){
                        fnOpenAlertPopup.alert('알림', '조회에 실패하였습니다.<br>'+
                                '잠시 후 다시 시도해 주세요.', function (res) {
                            if (res) {      
                            }
                        });
                    },
                    complete: function(){
                        fnLodingClose();
                    }
                });
            }
        }
        else if(gubun_find === "findPw"){
            
            if(fnCheckUserInfo($('#userIdForFindPwByEmailAuth'), 'none', $('#userNameForFindPw'), $('#userBirthForFindPw'), "findPw", true)){
                
                const userId = $('#userIdForFindPwByEmailAuth').val();
                const name = $('#userNameForFindPw').val();
                const birthDay = $('#userBirthForFindPw').val();
                //gender = $('input[name="genderForFindPw"]:checked').val();
                const userGbn = $('input[name="idCateForFindPw"]:checked').val();
                
                fnLodingOpen();

                $.ajax({
                    url: "/sso/MyCertCtr/findEmail.do",
                    type: "POST",
                    data: {
                        name: name,
                        birthDay: birthDay,
                        userGbn: userGbn,
                        persNo: userId
                    },
                    dataType: "json",
                    success: function(data){
                     
                        const userInfo = data.userInfo;
         
                        if(!fnCheckValid(userInfo)){
                        
                          fnOpenAlertPopup.alert('알림', '일치하는 정보를 찾을 수 없습니다.<br>'+
                                  '입력하신 정보를 확인해 주세요.', function (res) {
                                if (res) {      
                                }
                            });
                            return false;   
                          
                        }else if(!fnCheckValid(userInfo.email)){
                            fnOpenAlertPopup.alert('알림', '등록된 이메일 정보가 없습니다.<br>'+
                                    '휴대폰 인증 혹은 비밀번호 초기화 신청 해주세요.', function (res) {
                                if (res) {      
                                }
                            });
                            return false;   
                          
                        }else{
                            $('#emailListForFindId').empty();
                            $('#emailListForFindPw').empty();
                          
                            let html = "";
                            html += '<p class="box_title">인증코드 발송</p>';
                            html += '<div class="dl_wrap03">';
                            html += '<div class="dl_row email_send_box type2">';
                            html += '<div class="dl_col email_list">';
                            html += '<div class="col_box">';

                            html += '<input type="hidden" id="'+ userInfo.persNo +'" name="selectEmailForSendCode" value="' + userInfo.email + '" title="비밀번호 찾기 이메일 인증코드" readonly/>'; 
                            html += '<div>' + userInfo.maskingEmail + '</div>';

                            html += '</div>'; 
                            html += '</div>'; 
                            html += '<div class="dl_col email_send_btn auth_btn">'; 
                            html += '<button type="button" class="btn btn_normal btn_code3" onclick="javascript:fnSendEmailCode(\''+gubun_find+'\');">인증코드 발송</button>'; 
                            html += '</div>'; 
                            html += '</div>'; 
                            html += '</div>'; 
    
                            $('#emailListForFindPw').append(html);
                            $('#userInfoAuthForFindPw').hide();
                            $('#sendEmailCodeForFindPw').show();
                          
                        }
                    },
                    error: function(){
                        fnOpenAlertPopup.alert('알림', '조회에 실패하였습니다.<br>'
                                +'잠시 후 다시 시도해 주세요.', function (res) {
                            if (res) {      
                            }
                        });
                    },
                    complete: function(){
                        fnLodingClose();
                    }
                });
            }
        } 
    }
    else if(gubun_auth === "emailAuth"){
        
        if(fnCheckTimeOut()){
            fnOpenAlertPopup.alert('알림', '인증유효시간이 만료되었습니다.<br>'+
                    '인증코드를 다시 발송해 주세요.', function (res) {
                if (res) {   
                    $('#inAuthNum').val('');
                    $('#sendEmailCodeForFindId').show();        
                    $('#emailAuthForFindId').hide();
                    
                    $('#inAuthNumByPhoneNo').val('');
                    $('#sendEmailCodeForFindPw').show('');
                    $('#emailAuthForFindPw').hide();
                }
            });
            return false;
        }
        
        if(gubun_find === "findId"){
            
            var params = {};
            params.authNum = $('#inAuthNum').val();
            params.recprNm = $('#userNameForFindId').val();

            fnLodingOpen();
            
            $.ajax({
                url: "/sso/MyCertCtr/findUserInfoByEmailAuth.do",
                data: params,
                type: 'post',
                dataType: "json",
                success: function(data){
  
                    if(data.resultCode === '0'){
                        // 유효시간 초기화
                        fnTimeOut();   
                        $('#resultFindIdByEmail').empty();                                                              
                        fnCreatefindIdResultForm($('#emailAuthForFindId'), $('#resultFindIdByEmail'), data.userInfoList);

                    }
                    else{
                        fnOpenAlertPopup.alert('알림', '인증코드가 맞지 않습니다.<br>'+
                                '인증코드를 다시 확인해 주세요.', function (res) {
                            if (res) {   
                                $('#inAuthNum').focus();                
                            }
                        });
                        return false;
                    }
                },
                error: function(){
                    
                    fnOpenAlertPopup.alert('알림', '조회에 실패하였습니다.<br>'+
                            '잠시 후 다시 시도해 주세요.', function (res) {
                        if (res) {      
                           location.reload();
                        }
                    });
                },
                complete: function(){           
                    fnLodingClose();
                }
            });
        }else if(gubun_find === "findPw"){
            
            var params = {};
            params.authNum = $('#inAuthNumByPhoneNo').val();            
            fnLodingOpen();
            
            $.ajax({
                url: "/sso/MyCertCtr/checkTempCode.do",
                data: params,
                type: 'post',
                dataType: "json",
                success: function(data){
  
                    if(data.resultCode === '1'){
                        // 유효시간 초기화
                        fnTimeOut();  
                        $('#emailAuthForFindPw').hide();
                        $('#changePwByEmail').show();
                    } 
                    else{
                        fnOpenAlertPopup.alert('알림', '인증코드가 맞지 않습니다.<br>'+
                                '인증코드를 다시 확인해 주세요.', function (res) {
                            if (res) {   
                                $('#inAuthNumByPhoneNo').focus();
                            }
                        });
                        return false;
                    }
                },
                error: function(){
                    fnOpenAlertPopup.alert('알림', '인증코드 발송 오류가 발생하였습니다.<br>'+
                            '잠시 후 다시 시도해 주세요.', function (res) {
                        if (res) {      
                        }
                    });
                },
                complete: function(){
                    fnLodingClose();
                }
            });
        }
    }
}

function fnPhoneAuth(params){

    setTimeout(function(){

        const agent = 'win16|win32|win64|macintel|mac';
        let mode = 'web';
        
        // 태블릿도 모바일과 동일하게 처리
        // 23. 3. 9. 자이닉스 앱 팝업 차단 이슈 보완
        if(agent.indexOf(navigator.platform.toLowerCase()) < 0 || fnIsTablet() == true || fnIsLearningX() == true){
            mode = 'mobile';
        }
        
        params.appGubun = APP_GUBUN;
        params.mode = mode;
        
        $.ajax({
            url : '/sso/MyCertCtr/reqMyCert.do',
            data : params,
            type : 'post',
            dataType : 'json',
            success : function(data) {
                
                if(data.reqSuccessYN == 'Y'){
                    
                    $('#tr_cert').val(data.tr_cert);
                    $('#tr_url').val(data.tr_url);
                    $('#tr_add').val(data.tr_add);
                       
                    window.name = "kmcis_web";
                    let KMCIS_window;
                    let UserAgent = navigator.userAgent;
                    /* 모바일 접근 체크*/
                    // 모바일일 경우 (변동사항 있을경우 추가 필요)
                    //if (UserAgent.match(/iPhone|iPod|Android|Windows CE|BlackBerry|Symbian|Windows Phone|webOS|Opera Mini|Opera Mobi|POLARIS|IEMobile|lgtelecom|nokia|SonyEricsson/i) != null || UserAgent.match(/LG|SAMSUNG|Samsung/) != null) {
      
                    if(mode === 'mobile') {
                        document.reqKMCISForm.target = ''; 
                        document.reqKMCISForm.submit();
                    // 모바일이 아닐 경우
                    } else {
                        KMCIS_window = window.open('?kmcis=Y', 'KMCISWindow', 'width=425, height=650, resizable=0, scrollbars=no, status=0, titlebar=0, toolbar=0, left=435, top=250' );
                        if(KMCIS_window == null){     
                          
                            fnOpenAlertPopup.alert('알림', '팝업이 차단되어 있습니다.<br>'+
                                '브라우저 설정에서 팝업 차단을 해제하신 후 다시 시도해 주세요.', function (res) {
                                if (res) {   
                                    //location.reload();
                                }
                            });
                            return false;
                        }
                        KMCIS_window.document.write(reqKMCISForm.outerHTML);
                        KMCIS_window.document.reqKMCISForm.submit();
                    }
    
                }else{
    
                    fnOpenAlertPopup.alert('알림', '모바일 본인인증에 오류가 발생하였습니다.<br>'+
                            '잠시 후 다시 시도해 주세요.', function (res) {
                        if (res) {      
                        }
                    });
                    return false;
                }
            }, error : function(requst, status) {
                
                fnOpenAlertPopup.alert('알림', status, function (res) {
                    if (res) {      
                    }
                });
                return false;
            },
            complete: function(){   
            }
        });
    }, 100);
}

// 핸드폰 본인인증 결과
function fnPhoneAuthResult(gubun, data, afterGubun){

    if(gubun == 'regPinNo'){
        $('#loginIdPin').val(data);
        fnChangePinLoginForm('registerForm');
        //fnPinLoginForm('registerForm', 'register');   // 간편번호 신규등록
        $('#pinNo1').focus();
    }else if(gubun == 'findId'){
        
        const dataList = JSON.parse(data);
        
        if(fnCheckValid(dataList)){
            $('#resultFindIdByPhone').empty();
            fnOpenAlertPopup.alert('알림', '학번이 조회되었습니다.', function (res) {    
                if (res) {   
                    fnCreatefindIdResultForm($('#phoneAuthForFindId'), $('#resultFindIdByPhone'), dataList);
                }
            });
        }else{
             fnOpenAlertPopup.alert('알림', '입력하신 정보와 일치하는 학번을 찾을 수 없습니다.<br>'+
                     '입력 값을 확인해 주세요.', function (res) {    
                if (res) {            
                }
             });
        }
        
    }else if(gubun == 'findPw'){
        $('#phoneAuthForFindPw').hide();
        $('#changePwByPhone').show();
    }else if(gubun == 'selfAuth'){
         
        if(data == '1'){
             fnOpenAlertPopup.alert('알림', '휴대폰 본인인증이 완료되었습니다.', function (res) {
                 if (res) {      
                     fnLoginKakao('formKakao');
                 }
             });
        }else{
            fnOpenAlertPopup.alert('알림', '이미 본인인증을 완료하셨거나 <br>'+
                    '본인인증 대상이 아닙니다.', function (res) {
                 if (res) {      
                 }
             });
        }
    }else if(gubun == 'phoneNoMissMatch'){
        
        let focusObj = $('#authRegPin');
        
        let msg = '학번 개인 정보와 휴대폰 본인인증 정보가 ';
        msg += '일치하지 않습니다.<br>';
        msg += '본인 명의의 휴대폰이 아닌 경우, 간편번호를 ';
        msg += '등록할 수 없습니다.<br><br>';
        msg += '<a href="/sso/DelyCtr/delayApplyAuth.do" target="_blank">※ 학습로그인 유예 신청 안내</a>'
        
        if(afterGubun == 'findPw'){
            msg = '학번 개인 정보와 휴대폰 본인인증 정보가 일치하지 않아 ';
            msg += '비밀번호 찾기에 실패했습니다.<br>';
            msg += '이메일 인증 혹은 비밀번호 초기화 신청해 주세요.​';
            focusObj = $('#userIdForFindPw');
        }
        
        //예외처리
        if(fnCheckValid(PHONE_AUTH_GUBUN)){
            fnChangePinLoginForm('authForm');
        }
        
        fnOpenAlertPopup.alert('알림', msg, function (res) {
            if (res) {  
                focusObj.focus();
            }
        });    
    }else if(gubun == 'sameUserInfo'){ // 비번 찾기 때 동명이인 존재
         fnOpenAlertPopup.alert('알림', '동명이인 계정이 존재하여,<br>비밀번호를 변경할 수 없습니다.<br>'+
                 '이메일인증 혹은 비밀번호 초기화 신청해 주세요.', function (res) {
             if (res) {  
                 $('#userIdForFindPw').focus();
             }
         });   
    }else if(gubun == 'selfAuthFail'){
        fnOpenAlertPopup.alert('알림', '학번 개인 정보와 휴대폰 본인인증 정보가 '+
                '일치하지 않습니다.<br>'+
                '본인 명의의 휴대폰이 아닌 경우, 카카오 로그인'+
                '서비스를 이용할 수 없습니다.<br><br>​'+
                '<a href="/sso/DelyCtr/delayApplyAuth.do" target="_blank">※학습로그인 유예 신청 안내</a>', function (res) {
            if (res) {  
                $('#authLoginIdPin').focus();
            }
        });  
    }else if(gubun == 'updatePhoneNo'){

        const result = JSON.parse(data);

        fnOpenAlertPopup.confirm('알림', '본교에 등록된 휴대전화번호와 일치하지 않습니다.<br>'+
                '개인정보를 업데이트 하시겠습니까?<br><br>'+
                '등록된 번호 : ' + result.preHandpNo + '<br>'+
                '인증된 번호 : ' + result.nowHandpNo, function (res) {
            
            if (res) {  
                fnLodingOpen();
                $.ajax({
                    url: '/sso/MyCertCtr/updatePhoneNo.do',  
                    type: 'post',
                    dataType: 'json',
                    success: function(data){    
                        
                        if(data.resultCode == '1'){
                            fnOpenAlertPopup.alert('알림', '개인정보 업데이트가 완료되었습니다.', function (res) {
                                if (res) { 
                                    fnPhoneAuthResult(afterGubun, result.userId, ''); 
                                    $('#pinNo1').focus();
                                }
                            });
                        }else{
                            fnOpenAlertPopup.alert('알림', '개인정보 업데이트에 실패하였습니다.<br>'+
                                    '잠시 후 다시 시도해 주세요.', function (res) {
                                if (res) {   
                                    location.reload();
                                }
                            });
                        }
                    },
                    error: function(){
                        fnOpenAlertPopup.alert('알림', '개인정보 업데이트에 실패하였습니다.<br>'+
                                '잠시 후 다시 시도해 주세요.', function (res) {
                            if (res) {     
                                location.reload();
                            }
                        });
                    },
                    complete: function(){
                        fnLodingClose();                                                        
                    }
                });                 
             }else{
                 fnPhoneAuthResult(afterGubun, result.userId, '');
                 $('#pinNo1').focus();
             }
         });         
    }
}

function fnSendEmailCode(gubun){
    
    if(gubun == ''){
        fnOpenAlertPopup.alert('알림', '인증코드 발송에 실패했습니다.<br>'+
                '잠시 후 다시 시도해 주세요.', function (res) {
            if (res) {      
            }
        });
        return false;   
    }
    // 타이머 셋팅 시간(정수값 초단위), 출력 분, 출력 초
    fnSetTimer(60 * 5, "05", "00");
 
    // 학번/사번 찾기 1, 비번 찾기 2
    const authGbn = (gubun === 'findId') ? '1' : '2';

    let params = {};
    if(gubun === 'findId'){
        params.authGbn = '1';
        params.recprNm = $('#userNameForFindId').val();       
        params.recprPersNo = $('input[name="selectEmailForSendCode"]:checked').attr('id');
        params.recprEmailAddr = $('input[name="selectEmailForSendCode"]:checked').val();
    }else{
        params.authGbn = '2';
        params.recprNm = $('#userNameForFindPw').val();
        params.recprPersNo = $('#emailListForFindPw input').attr('id');
        params.recprEmailAddr = $('#emailListForFindPw input').val();
    }

    fnLodingOpen();
    
    $.ajax({
        url: "/sso/MyCertCtr/reqMyCertEmail.do",
        data: params,   
        type: 'post',
        dataType: "json",
        success: function(data){
            fnOpenAlertPopup.alert('알림', '선택하신 메일로 인증코드 4자리를 발송했습니다.', function (res) {
                if (res) {    
                    if(gubun == "findId"){
                        $('#sendEmailCodeForFindId').hide();
                        $('#emailAuthForFindId').show();
                        fnTimer($('#timer'), gubun);
                        $('#inAuthNum').focus();
                        
                    }else{
                        $('#sendEmailCodeForFindPw').hide();
                        $('#emailAuthForFindPw').show();
                        fnTimer($('#timerForFindPw'), gubun);
                        $('#inAuthNumByPhoneNo').focus();
                    }
                }   
            });
        },
        error: function(){
            fnOpenAlertPopup.alert('알림', '인증코드 발송이 실패하였습니다.<br>'+
                    '전송버튼을 다시 눌러주세요.', function (res) {
                if (res) {      
                }
            });
        },
        complete: function(){
            fnLodingClose();
        }
    });
}

function fnSetTimer(time, printMin, printSec){
    
    clearInterval(intervalId); 
    authTime = time;
    min = printMin;
    sec = printSec;
}

function fnTimer(tag, gubun){
    
    tag.text(min + ' : ' + sec);
     
    intervalId = setInterval(function(){
        authTime -= 1;

        if(authTime < 0){

             if(gubun == 'findId'){
                 fnOpenAlertPopup.alert('알림', '인증 유효시간이 만료되었습니다.<br>'+
                         '인증코드를 다시 발송해 주세요.', function (res) {
                     if (res) {  
                         //이전화면
                         $('#inAuthNum').val('');
                         $('#sendEmailCodeForFindId').show();        
                         $('#emailAuthForFindId').hide();
                     }
                 });
             }else if(gubun == 'findPw'){
                 fnOpenAlertPopup.alert('알림', '인증 유효시간이 만료되었습니다.<br>'+
                         '인증코드를 다시 발송해 주세요.', function (res) {
                     if (res) {  
                         //이전화면
                         $('#inAuthNumByPhoneNo').val('');
                         $('#sendEmailCodeForFindPw').show('');
                         $('#emailAuthForFindPw').hide();
                     }
                 });
             }
             
            clearInterval(intervalId);
        }
        else{

            min = "0" + parseInt(authTime / 60);
            sec = authTime % 60;
            if(sec < 10){
                sec = "0" + sec;
            }
            
            tag.text(min + ' : ' + sec);
        }
    }, 1000);
}

function fnTimer2(){
    
    intervalId = setInterval(function(){
        authTime -= 1;
        
        if(authTime < 0){

            clearInterval(intervalId);
        }       
    }, 1000);
}

function fnTimeOut(){
    
    authTime = 0;
    min = '';
    sec = '';
    clearInterval(intervalId);    
}

function fnCheckTimeOut(){

    if(authTime <= 0){
        return true;
    }
    return false;
}

function fnChangePw(gubun){
    
    fnTimeOut();
    
    let inputPwd = "";

    if(gubun === 'email'){
        inputPwd = $('#newPwByEmail01').val();
        const inputPwd2 = $('#newPwByEmail02').val();
  
        if(inputPwd == ''){
            fnOpenAlertPopup.alert('알림', '비밀번호를 입력하세요.', function (res) {
                if (res) {      
                    $('#newPwByEmail01').focus();
                }
            });
            return false;
        }
        
        if(inputPwd2 == ''){
            fnOpenAlertPopup.alert('알림', '비밀번호를 입력하세요.', function (res) {
                if (res) {   
                    $('#newPwByEmail02').focus();
                }
            });
            return false;
        }
        
        if(inputPwd != inputPwd2){
            fnOpenAlertPopup.alert('알림', '비밀번호를 동일하게 입력해 주세요.', function (res) {
                if (res) {    
                    $('#newPwByEmail02').focus();
                }
            });
            return false;
        }
    }else{
        
        inputPwd = $('#newPwByPhone01').val();
        const inputPwd2 = $('#newPwByPhone02').val();
        
        if(inputPwd == ''){
            fnOpenAlertPopup.alert('알림', '비밀번호를 입력해주세요.', function (res) {
                if (res) {      
                    $('#newPwByPhone01').focus();
                }
            });
            return false;
        }
        
        if(inputPwd2 == ''){
            fnOpenAlertPopup.alert('알림', '비밀번호를 입력해주세요.', function (res) {
                if (res) {   
                    $('#newPwByPhone02').focus();
                }
            });
            return false;
        }
        
        if(inputPwd != inputPwd2){
            fnOpenAlertPopup.alert('알림', '비밀번호를 동일하게 입력해주세요.', function (res) {
                if (res) {   
                    $('#newPwByPhone02').focus();
                }
            });
            return false;
        }
    }
    
    fnLodingOpen();
    
    $.ajax({
        url: "/sso/MyCertCtr/updatePW.do",
        data: {
            pwd: inputPwd
        },
        type: 'post',
        dataType: "json",
        success: function(data){
            if(data.result === "success"){
                
                fnOpenAlertPopup.alert('알림', '비밀번호가 변경되었습니다.', function (res) {
                    if (res) {      
                        location.reload();
                    }
                });
            }
            else if(data.result === "fail"){
                fnOpenAlertPopup.alert('알림', data.msg, function (res) {
                    if (res) {   
                        if(gubun == 'email'){
                            $('#newPwByEmail01').focus();
                        }else{
                            $('#newPwByPhone01').focus();
                        }
                    }
                });
                return false;
            }
        },
        error: function(data){
            fnOpenAlertPopup.alert('알림', '비밀번호 변경 오류가 발생하였습니다.<br>'
                    +'잠시 후 다시 시도해 주세요.', function (res) {
                if (res) {      
                }
            });
        },
        complete: function(){
            fnLodingClose();
        }
    });
}


// ============================================================= PIN 로그인 =================================================================
 
function fnDefaultPinLoginForm(){

    magicsa.getKeyStore('keyStore').then(function (result) {  
        
        if(fnCheckValid(result)){

            fnLodingOpen();
             //서버에 유효한 값이 있는지 체크
             $.ajax({
                 url: "/sso/MyCertCtr/findPinInfoCnt.do",
                 data: {
                     keyId: result.keyid
                 },
                 type : 'post',
                 dataType: "json",
                 success: function(data){
                     if(data.count == 1){                           
                         fnChangePinLoginForm('loginForm');
                         
                         if($.cookie("cookieFocusCheck") == "Easy"){  
                             $('#container .tab .tab_cont_box .form_list.mobile .form_item.easy').addClass('active');
                             $('#pinNo').focus();
                         }
                     }else{
                         //서버에 유효한 정보가 없다면 local storage 값 삭제
                         fnOpenAlertPopup.alert('알림', '등록된 간편번호가 없습니다<br>'+
                                 '간편번호를 등록해 주세요.', function (res) {
                             if (res) { 
                                 magicsa.delKeyStore('keyStore').then(function (result) {
                                 });                            
                                 $('#authRegPin').focus();
                             }
                         });
                         fnChangePinLoginForm('authForm');
                         return false;                                      
                     }                   
                 },
                 error: function(data){

                     fnOpenAlertPopup.alert('알림', '등록된 간편번호를 확인 중 오류가 발생했습니다.<br>'
                             +'잠시 후 다시 시도해 주세요.', function (res) {
                         if (res) {
                             fnChangePinLoginForm('authForm');                              
                         }
                     });
                 },
                 complete: function(){         
                       fnLodingClose();
                 }
            });
        }else{
            //모바일 인증 이후
            if(PHONE_AUTH_GUBUN == 'regPinNo'){
                
                // 기존 디폴트 탭 정보 제거
                let list_active = $('#container .tab_btn_list li');
                list_active.removeClass('active');
                $('#container .tab .tab_cont_box').removeClass('on');  
                
                // 스마트 로그인 탭으로 변경
                list_active = $('#container .tab_btn_list li[data-tab="learningLogin"]');                  
                list_active.addClass('active');
                $('#learningLogin').addClass('on');
                
                // 간편번호 로그인 폼 활성화
                $('#container .tab .tab_cont_box .form_list.mobile .form_item.easy').addClass('active');
                fnMobileRespMyCert();
            }else{
                fnChangePinLoginForm('authForm');
            }
            fnLodingClose();
        }    
   });

}
/*
function fnPinLoginForm(formType, state){
    
    let inputForm = '';
    let button = '';
    let subButton = '';
    
    $('#pinLoginForm').empty();
    $('#pinButton').empty();
    $('#pinSubButton').empty();
    
    let checkPoint = '';
    
    if(state == 'reRegister'){
        checkPoint = 'reRegPinNo';
    }else{
        checkPoint = 'regPinNo';
    }

    if(formType == 'authForm'){   
        inputForm += '<p class="desc">간편번호(숫자 6자리)를<br>등록하고 로그인하세요.</P>';
        inputForm += '<input type="text" id="authLoginIdPin001" tabindex="-1" name="authLoginIdPin001" style="width:0px;height:0px;position: absolute; opacity: 0;">';
        inputForm += '<input type="password" id="authLoginPwPin001" tabindex="-1" name="authLoginPwPin001" style="width:0px;height:0px;position: absolute; opacity: 0;">';
        inputForm += '<input type="text"  id="authRegPin" title="학번" placeholder="학번" class="input_id" onkeypress="fnEnterkey(\'regPinNo\');" maxlength="11" tabindex="4" autocomplete="new-password">'; 

        button += '<button type="button" class="btn btn_default" onclick="javascript:fnStartPinReg(\'regPinNo\'); return false;" title="간편번호 신규등록" data-tooltip="focus11" tabindex="5">신규등록</button>';
        
    }else if(formType == 'registerForm'){       
        inputForm += '<p class="desc" style="margin-bottom: 10px;">숫자 6자리를 입력해 주세요.</p>'; 
        
        inputForm += '<input type="password" id="pinNo001" name="pinNo001" tabindex="-1"  style="width:0px;height:0px;position: absolute; opacity: 0;">';
        inputForm += '<input type="password" id="pinNo002" name="pinNo002" tabindex="-1" style="width:0px;height:0px;position: absolute; opacity: 0;">';
        
        inputForm += '<input type="password" id="pinNo1" name="pinNo1" tabindex="3" title="간편번호" class="form-control" placeholder="******" onclick="javascript:fnOpenVitualKeyboard(this); return false;" onfocus="fnOpenVitualKeyboard(this);" readonly maxlength="6" autocomplete="new-password">'; 
        inputForm += '<input type="password" id="pinNo2" name="pinNo2" tabindex="4" title="간편번호" class="form-control" placeholder="******" onclick="javascript:fnOpenVitualKeyboard(this); return false;" onfocus="fnOpenVitualKeyboard(this);" readonly maxlength="6" autocomplete="new-password">';

        button += '<button type="button" class="btn btn_default" onclick="javascript:fnProcessPinState(\''+state+'\'); return false;" title="간편번호 등록" data-tooltip="focus12" tabindex="5">등록</button>';
        button += '<button type="button" class="btn btn_default" onclick="javascript:fnCancelPinReg(); return false;" title="간편번호 등록 취소" data-tooltip="focus13" tabindex="6">취소</button>';            
  
    }else if(formType == 'loginForm'){   
        inputForm += '<p class="desc">간편번호(숫자 6자리)를 입력하여 로그인하세요.</p>'; 
        inputForm += '<input type="password" tabindex="-1" style="width:0px;height:0px;position: absolute; opacity: 0;">'; 

        inputForm += '<input type="password" id="pinNo" name="pinNo" title="간편번호" placeholder="******" class="input_id" onclick="javascript:fnOpenVitualKeyboard(this); return false;" readonly maxlength="6" tabindex="4" onfocus="fnPinFocus(this)" autocomplete="new-password">';

        button += '<button type="button" id="pinLoginBtn" class="btn btn_default" onclick="javascript:fnLoginPin();" title="간편번호 로그인" data-tooltip="focus14" tabindex="5">로그인</button>'; 
        subButton += '</span><a href="#"  class="f_desc" onclick="javascript:fnProcessPinState(\'delete\'); return false;" data-tooltip="focus16" tabindex="6">삭제</a>';
    }

    $('#pinLoginForm').append(inputForm);
    $('#pinButton').append(button);
    $('#pinSubButton').append(subButton);

}
*/
/*function fnPinFocus(obj){
    
    if($(obj).attr('class') == 'input_id'){
        $(obj).trigger('click');
    }
}*/

function fnStartPinReg(gubun) {

    if(!findLoginConf(PIN_LOGIN_CONF_CODE)){
        return false;
    }
    
    if(fnCheckUserInfo($("#authRegPin"), 'none', 'none', 'none', 'pin', true)){
        
        // 휴대폰 본인인증    
        var params = {};
        params.gubun = gubun;
        params.userId = $("#authRegPin").val();

        //fnChangePinLoginForm('registerForm');
        fnPhoneAuth(params);
    }
}

function fnCancelPinReg(){
    fnOpenAlertPopup.changeConfirmBtnNm('취소하기', '돌아가기');
    fnOpenAlertPopup.confirm('알림', '간편번호 등록을 취소하시겠습니까?', function (res) {
        if (res) {
            fnChangePinLoginForm('authForm');  
        }
    });
}

function fnProcessPinState(state){

    const userId = $("#loginIdPin").val().toUpperCase();
    const inputType = 'pin'; // 사용자가 선택한 입력 UI 구분 값  

    if(state == 'delete'){    
        fnOpenAlertPopup.changeConfirmBtnNm('삭제하기', '돌아가기');
        fnOpenAlertPopup.confirm('알림', '등록된 간편번호를 삭제하시겠습니까?', function (res) {
            if (res) {   
                
                 fnLodingOpen();
                
                 magicsa.deRegister().then(function (result) {  
                     
                     if(result.status == 200) {     

                         $.ajax({
                             url : "/sso/LogCtr/deletePinUserLog.do",
                             type : 'post',
                             data : {keyId : result.keyid},
                             dataType : 'json',
                             success : function(rslt) {                                        
                             }, error : function(requst, status) {
                             }, complete : function(){
                                fnLodingClose();
                                fnChangePinLoginForm('authForm');                               
                                //fnPinLoginForm('authForm', 'none');  
                             }
                         });
                                    
                     }else{
                         fnLodingClose();
                         fnOpenAlertPopup.alert('알림', '간편번호 삭제 중 오류가 발생하였습니다.<br>'+
                                 '담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
                                 '에러코드 : 간편번호 삭제 실패', function (res) {
                             if (res) {      
                                 
                             }
                         }); 
                     }                    
                 });            
            }           
            return false;
        });
    }else{

        const newPinNo = $("#pinNo1").val();
        const newPinNo2 = $("#pinNo2").val();
        const regex = /^[0-9]{6}/;  // 숫자 6자리인지 정규표현식으로 체크
        if(!fnCheckFormat(regex, newPinNo) || !fnCheckFormat(regex, newPinNo2)){
            fnOpenAlertPopup.alert('알림', '간편번호는 숫자6자리로 입력하세요.', function (res) {
                if (res) {      
                }
            });        
            return false;
        }

        if(newPinNo == newPinNo2){

            // 등록요청을 위해 register 메소드를 호출한다.            
            if(state == 'register'){
                
                //입력한 학번이 없는 경우
                if(!fnCheckValid(userId)){
                    
                    fnOpenAlertPopup.alert('알림', '간편번호 등록 중 오류가 발생하였습니다.<br>'+
                            '담당자(02-2290-0207)에게 문의 부탁드립니다.', function (res) {
                         if (res) {
                            fnChangePinLoginForm('authForm');
                            initVirtualKeyboard('pinRegError');
                         }
                     });
                     return false;   
                }        
                
                fnLodingOpen();
                 
                let reponseTime = setTimeout(function(){
                     fnLodingClose();
                     fnOpenAlertPopup.alert('알림', '간편번호 등록 중 오류가 발생하였습니다.<br>'+
                             '담당자(2290-0207)에게 문의 부탁드립니다.<br>'+
                             '에러코드 : 서버 통신 오류', function (res) {
                         if (res) {   
                             
                         }
                     });     
                     return false;
                }, 10000);
                
                
                magicsa.register(userId, inputType, newPinNo).then(function (result) {  
                    fnLodingClose();
                    if(result.status == 200) {  
                        
                        var fp = "";
                        magicsa.getFingerprintHash().then(function(resultFp) {
                            fp = resultFp;
                        });
                        
                        clearTimeout(reponseTime);

                        fnLodingClose();
                        
                        // 처리 성공 시 수행할 코드                  
                        fnOpenAlertPopup.alert('알림', '간편번호가 등록 되었습니다.<br>등록하신 간편번호로 로그인 하세요.', function (res) {
                            if (res) {  
                                fnLodingOpen();
                                //간편번호 등록 로그 저장
                                $.ajax({
                                    url : "/sso/LogCtr/insertPinLog.do",
                                    type : 'post',
                                    data : {keyId : result.keyid, fp : fp},
                                    dataType : 'json',
                                    success : function(rslt) {                                        
                                    }, error : function(requst, status) {
                                    }, complete : function(){
                                        fnLodingClose();
                                        fnChangePinLoginForm('loginForm');
                                        //fnPinLoginForm('loginForm', 'login');                             
                                        initVirtualKeyboard('pinRegSuccess'); 
                                    }
                                });               
                            }
                        });
                        
                    }else if(result.status == 110){  
                        fnOpenAlertPopup.alert('알림', '이미 등록된 사용자입니다.', function (res) {
                            if (res) {      
                                fnChangePinLoginForm('authForm');
                                initVirtualKeyboard('pinRegError');
                            }
                        });
                    }else{
                        fnOpenAlertPopup.alert('알림', '간편번호 등록 중 오류가 발생하였습니다.<br>'+
                                '담당자(02-2290-0207)에게 문의 부탁드립니다.', function (res) {
                            if (res) {
                                fnChangePinLoginForm('authForm');
                                initVirtualKeyboard('pinRegError');
                            }
                        });
                        return false;   
                    }
                });  
            }
        }else{
            fnOpenAlertPopup.alert('알림', '간편번호가 일치하지 않습니다.', function (res) {
                if (res) {      
                    initVirtualKeyboard('newPinNoMissMatch');               
                }              
            }); 
        }       
    }
}

var checkFlag = 'N';

function fnLoginPin(){

    if(!findLoginConf(PIN_LOGIN_CONF_CODE)){
        return false;
    }
    
    // PIN 유효성 체크!
    const pinNo = $("#pinNo").val();
    if(!fnCheckValid(pinNo)){
        fnOpenAlertPopup.alert('알림', '간편번호를 입력해 주세요.', function (res) {
            if (res) {      
            }
        });
        return false;
    }

    fnDefaultPinLoginForm();

    fnLodingOpen();
    // 포커스인풋 박스 쿠키 설정
    // $.cookie("cookieFocusCheck", "Easy", {path: "/", domain: location.hostname, expires : 30 });
    $.cookie("cookieFocusCheck", "Easy", {path: "/", domain: ".hycu.ac.kr", expires : 30});
    
    magicsa.getFailureCount().then(function (result){
        
        if(result.status == 200) { 
            
            const errCnt = result.failcount;
            
            //if(errCnt >= 5 && (authTime > 0 || checkFlag == 'N')){
            if(errCnt >= 5 && (authTime > 0)){
                fnCheckPinError(errCnt);
                fnLodingClose();
                return false;
            }
            
            magicsa.authenticate(pinNo).then(function (result) {
                
                if(result.status == 200){
                    
                    magicsa.resetFailureCount().then(function (result) {
                           
                      if(result.status == 200){
                           $.ajax({
                               url : "/sso/LoginCtr/findUserIdByKey.do",
                               data : {key : result.keyid},
                               type : 'post',
                               dataType : 'json',
                               success : function(data) {
                                   const findYN = data.findYN;
                                   if (findYN === "Y") {
                                       // 직원, 조교가 외부망에서 접속 시
                                       if (checkIP("pin") === "false") {
                                           // MFA gubun 변경
                                           $("#mfaGubun").val("pin"); // 간편번호

                                           // 팝업을 표시하고 완료 버튼 클릭을 기다림
                                           $("#popup_mfa").css('display',
                                               'flex').focus();
                                           // $("#loginIdMfa").val(data.userId); // 팝업 내에 학번저장 기능 추가(2025-09-01)
                                           // $("#loginPwdMfa").focus();
                                       } else {
                                           // 교수, 학생인 경우 외부망 체크 skip
                                           document.loginFormPin.submit();
                                       }
                                   }else{
                                       fnOpenAlertPopup.alert('알림', '사용자 정보가 일치하지 않습니다', function (res) {
                                           if (res) {
                                               $('#pinNo').focus();
                                           }
                                       });
                                   }      
                               }, error : function(requst, status) {
                                   fnOpenAlertPopup.alert('알림', '간편번호 인증에 오류가 발생하였습니다.<br>잠시 후 다시 시도해 주세요.', function (res) {
                                       if (res) {      
                                          $('#pinNo').focus();
                                       }
                                   }); 
                               }, complete : function(){
                                   fnLodingClose();
                               }
                           });
                       }else{
                           fnOpenAlertPopup.alert('알림', '간편번호 인증에 오류가 발생하였습니다.<br>'+
                           '담당자(02-2290-0207)에게 문의 부탁드립니다.'+
                           '에러코드 : 서버 통신 오류', function (res) {
                               if (res) {      
                                  $('#pinNo').focus();
                               }
                           });
                           fnLodingClose();
                       }
                   });
                }else{
                     // 처리 오류 시 수행할 코드
                     if(result.status == 100){

                          //if(errCnt >= 5 && checkFlag == 'Y' && (authTime <= 0)){
                           if(errCnt >= 5 && (authTime <= 0)){
                               magicsa.resetFailureCount().then(function (result) { 
                                   if(result.status == 200){
                                       fnCheckPinError();
                                   }
                               });
                           }else{                         
                                fnCheckPinError();                            
                           }
                      }else{
                           fnOpenAlertPopup.alert('알림', '간편번호 인증에 오류가 발생했습니다.<br>잠시 후 다시 시도해 주세요.', function (res) {
                              if (res) {      
                                  $('#pinNo').focus();
                              }
                          });   
                      }
                      fnLodingClose();
                 }
            });
        }
    });
}  

function fnCheckPinError(errCnt){
       
    if(errCnt >= 5){
           
           if(authTime <= 0){
               fnSetTimer(30, "00", "30");
               fnTimer2();  
               checkFlag = 'Y';
           }

           fnOpenAlertPopup.alert('알림', '간편번호 인증을 5회 이상 실패하였습니다.<br>' + authTime + '초 후에 다시 로그인하세요.', function (res) {
               if (res) {   
                   initVirtualKeyboard('pinLoginError');
               }
           });
     }else{
         magicsa.addFailureCount().then(function (result){

               if(result.status == 200){

                   const addErrCnt = result.failcount;
                   
                   if(addErrCnt >= 5){
                       if(authTime <= 0){
                           fnSetTimer(30, "00", "30");
                           fnTimer2();  
                           checkFlag = 'Y';
                       }
                
                       fnOpenAlertPopup.alert('알림', '간편번호 인증을 5회 이상 실패하셨습니다.<br>' + authTime + '초 후에 다시 로그인하세요.', function (res) {
                           if (res) {   
                               initVirtualKeyboard('pinLoginError');
                           }
                       });
                   }else{
                       fnOpenAlertPopup.alert('알림', '간편번호 입력 '+ addErrCnt +'회 실패하였습니다.<br>'+
                               '5회 이상 실패 시 로그인이 30초간 제한됩니다.', function (res) {
                            if (res) {      
                                initVirtualKeyboard('pinLoginError');                                                           
                            }
                       });
                   }
               }else{
                   fnOpenAlertPopup.alert('알림', '간편번호 인증에 오류가 발생하였습니다.<br>'+
                           '담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
                           '에러코드 : 서버 통신 오류', function (res) {
                         if (res) {    
                             initVirtualKeyboard('pinLoginError');
                         }      
                   });
               }
         });
     }  
}

function initVirtualKeyboard(gubun){

    openPopupYN = "N";
    
    if(gubun == 'pinRegSuccess'){   // 간편번호 등록 성공했을 때           
        $('#pinNo').focus(); 
    }else if(gubun == 'newPinNoMissMatch'){ // 간편번호 등록번호가 일치하지 않을 때
        $('#pinNo1').val('');
        $('#pinNo2').val('');
        $('#pinNo1').focus();
    }else if(gubun == 'pinLoginError'){  // 간편번호 로그인 실패시 
        $('#pinNo').val('');
        $('.ui-keyboard input').val('');
        $('#pinNo').focus();
        $('.ui-keyboard input').focus();
    }else if(gubun == 'pinRegError'){ // 간편번호 등록 실패시 
        $('#pinNo').focus();
    }
}

function fnOpenVitualKeyboard(obj){

     var keypad = [ '4 5 6 ',
            '7 8 9', 
            '0 1 2 ',
            '{bksp} 3 {a}'];
        
        if($(obj).attr('id') == 'pinNo'){
            keypad = [ '4 5 6 ',
                '7 8 9',
                '0 1 2 ',
                '{bksp} 3 {accept}'];
        }
        
     $(obj).keyboard({
        layout : 'custom',
        customLayout : {
             'normal' : keypad
        },
        maxLength : 6, //입력할 숫자 자리수  
        acceptValid : true,
        validate : function(keyboard, value, isClosing) { 

            let isTabKey = false;
            
            const inputTagId = $(obj).attr('id');
            
            if('PC' === DEVICE){
                if(isNumber(virtualKey) && value.length < 6){
                    value += virtualKey;
                    //$('input[name='+inputTagId+']').val(value);
                    keyboard.setValue(value);
                }else if(virtualKey == 'Backspace'){
                    if(value.length > 0){
                        value = value.slice(0, -1);
                        //$('input[name='+inputTagId+']').val(value);
                        keyboard.setValue(value);
                    }
                }else if(virtualKey == 'Enter'){
                    isClosing = true;                           
                }else if(virtualKey == 'Tab'){

                    if(inputTagId == 'pinNo'){

                        if(tabFlag == true){
                            keyboard.close();
                            tabFlag = false;
                            
                            if(shiftKey == true){
                                $('li[data-tab="defaultLogin"] a').focus();
                            }else{
                                $('#pinLoginBtn').focus();
                            }
                        }else{
                            tabFlag = true;
                        }
                    }
                }
            }

            keyboard.saveCaret(value.length, value.length);
            
            virtualKey = '';

            var test = /[\d]/i.test(value);
            /*
            if (isClosing && value.length != 6 && isTabKey == false) {   
                fnOpenAlertPopup.alert('알림', '간편번호는 숫자 6자리 입니다.', function (res) {
                    if (res) {      
                        $('.ui-keyboard input').focus();
                    }
                });
            }
            */
            
            if(isClosing && value.length == 6){
       
                setTimeout(function(){
             
                    if(inputTagId == 'pinNo1'){
                        $('#pinNo2').focus();
                        $('#pinNo1').val(value);                          
                    }else if(inputTagId == 'pinNo2'){
                        $('#pinNo2').val(value);
                        fnProcessPinState('register');
                    }else if(inputTagId == 'pinNo'){
                        $('#pinNo').val(value);
                        fnLoginPin();
                    }   
                    
                },100);
   
            }
            return value.length === 6;
        }
    }).addScramble({
        targetKeys : /[\d]/i, // numbers only  
        byRow : false, // do this or the zero doesn't scramble  
        // if randomizeOnce is true, the keys will be scramble the first time  
        // the keyboard becomes visible  
        randomizeOnce : true
    // randomizeInput : true     // if true, randomize after user input  
    });
    
}

function fnOpenPopup(gubun){

    fnInitFindInfo();
    
    if(gubun === "findId"){
        $('#findId').css('display','flex').hide().fadeIn().focus();
      //스크롤 막기
        $('body').addClass('notScroll');
    }
    else if(gubun === "findPw"){
        $('#findPw').css('display','flex').hide().fadeIn().focus();
      //스크롤 막기
        $('body').addClass('notScroll');
    }
    else if(gubun === "divQRView"){
        
        
        
        $('#divQRView').css('display','flex').hide().fadeIn().focus();
        //스크롤 막기
        $('body').addClass('notScroll');
    }
    else if(gubun === "popup_certificate"){
        
        if(!findLoginConf(PKI_LOGIN_CONF_CODE)){
            return false;
        }
        
        $('#certRegBody').empty();
        $('#certRegBody').append('<iframe id="certificateBody" src="/sso/AuthCtr/certReg.do" style="width: 100%; height: 650px; max-height: calc(100vh - 90px);" ></iframe>');
        $('#popup_certificate').css('display','flex').hide().fadeIn().focus();
      //스크롤 막기
        $('body').addClass('notScroll');
        //$('#certificateBody').attr('src', '/sso/AuthCtr/certReg.do');
        
    }
}

// 웹접근성 포커스 이동
function fnClosePopup(gubun){
    if(gubun === "findId"){
        $('#findId').focusout();
        $('#findId').css('display','');
        //스크롤 막기 해제
        $('body').removeClass('notScroll');
        $(".login_set_list [data-tooltip=findId] ").focus();
    }
    else if(gubun === "findPw"){
        $('#findPw').focusout();
        $('#findPw').css('display','');
        //스크롤 막기 해제
        $('body').removeClass('notScroll');
        $(".login_set_list [data-tooltip=findPw] ").focus();
    }
}

function fnInitFindInfo(){
    
    // 학번/사번 폼 초기화 
    $('#userNameForFindId').val('');
    $('#userBirthForFindId').val('');
    $('#inAuthNum').val('');
    
    $('#wrapPhoneAuthForFindId').show();
    $('#wrapEmailAuthForFindId').hide();
    
    $('.sId_find_wrap .sId_item').removeClass('active');
    $('#wrapPhoneAuthForFindId').parents('li').addClass('active');
    
    $('#emailAuthForFindId').hide();
    $('#resultFindIdByEmail').hide();

    $('#userInfoAuthForFindId').show();
    $('#phoneAuthForFindId').show();
    
    $('#resultFindIdByPhone').empty();
    
    // 비번 찾기.변경 폼 초기화 
    $('#userIdForFindPw').val('');
    $('#newPwByPhone01').val('');
    $('#newPwByPhone02').val('');
    $('#newPwByEmail01').val('');
    $('#newPwByEmail02').val('');
    $('#inAuthNumByPhoneNo').val('');
    
    $('#userIdForFindPwByEmailAuth').val('');
    $('#userNameForFindPw').val('');
    $('#userBirthForFindPw').val('');
    
    $('#emailAuthForFindPw').hide();
    $('#changePwByEmail').hide();
 
    $('#wrapPhoneAuthForFindPw').show();
    $('#wrapEmailAuthForFindPw').hide();
    
    $('#wrapPhoneAuthForFindPw').parents('li').addClass('active');
    
    $('#phoneAuthForFindPw').show();
    $('#userInfoAuthForFindPw').show();
    
    $('#changePwByPhone').hide();
    
    // 공통
    $('#emailListForFindId').empty();
    $('#emailListForFindPw').empty();
    
    $('#hoofGbn_10').css('display', 'none');
    
    fnTimeOut();
}

function fnInitPinInfo(){
    
    $('input[name=pinNo]').val('');
    $('input[name=pinNo1]').val('');
    $('input[name=pinNo2]').val('');

}

function fnMovePwdInitApplyPage(){
    window.open('/sso/InitCtr/passwordReset.do');
    location.reload();
}

function fnLoginQR(){

    window.open("/sso/ManualCtr/smartInfo.do", '스마트안내', 'width=1300,height=800,innerHeight=800,menubar=no,resizable=no,toolbar=no,scrollbars=yes');
}

function fnCreatefindIdResultForm(hideTag, showTag, dataList){
    
    let html = '<p class="box_title">학번조회내역</p>';
    html = '<div class="table table_list">';
    html += '   <table>';
    html += '       <colgroup>';
    html += '           <col style="width: 30%"/>';
    html += '           <col style="width: 50%"/>';
    html += '           <col style="width: 20%"/>';
    html += '       </colgroup>';
    html += '       <tr>';
    html += '           <th>학번</th>';
    html += '           <th>학과</th>';
    html += '           <th>구분</th>';
    html += '       </tr>';
    
    for(let i = 0; i < dataList.length; i++){
        html += '<tr>';
        html += '   <td>' + dataList[i].persNo + '</td>';
        html += '   <td>' + dataList[i].deptNm + '</td>';
        
        let hoofGbn = dataList[i].hoofGbn;
        if(hoofGbn === "1"){hoofGbn = "재직";}
        else if(hoofGbn === "2"){hoofGbn = "퇴직";}
        else if(hoofGbn === "3"){hoofGbn = "출산휴가";}
        else if(hoofGbn === "4"){hoofGbn = "공상휴직";}
        else if(hoofGbn === "5"){hoofGbn = "공상외휴직";}
        else if(hoofGbn === "6"){hoofGbn = "육아휴직";}
        else if(hoofGbn === "7"){hoofGbn = "임용대기";}
        else if(hoofGbn === "01"){hoofGbn = "재학";}
        else if(hoofGbn === "02"){hoofGbn = "휴학";}
        else if(hoofGbn === "04"){hoofGbn = "졸업";}
        else if(hoofGbn === "10"){hoofGbn = "제적"; $('#hoofGbn_10').css('display', 'block');}
        else if(hoofGbn === "20"){hoofGbn = "수료";}
        else if(hoofGbn === "30"){hoofGbn = "영구수료";}
        
        html += '   <td>' + hoofGbn + '</td>';
        html += '</tr>';
    }
    
    html += '   </table>';
    html += '</div>';
    
    hideTag.hide();
    showTag.append(html);
    showTag.show();
}

function fnKakaoErrorMsg(errorCode) {

    if (!fnCheckValid(errorCode)) {
        return;
    }

    let title = '알림';
    let msg = '';
    let popupType = 'alert';
    let isReload = false;

    if (errorCode == '100001') {
        msg = '학번을 입력하세요.';
    } else if (errorCode == '100002') {
        msg = '비밀번호를 입력하세요.';
    } else if (errorCode == '100003') {
        msg = '학번을 확인해 주세요.<br><br>';
        msg += '* 재학생인 경우 로그인 페이지 하단에 [학번찾기] 진행<br>';
        msg += '* 제적생인 경우 로그인 불가<br>';
        msg += '* 신,편입생인 경우 학적 생성 전까지<br>입학홈페이지(go.hycu.ac.kr) 이용';
        isReload = true;
    } else if (errorCode == '100004') {
        msg = '인증 요청 중 문제가 발생하였습니다';
        isReload = true;
    } else if (errorCode == '100005') {
        msg = '인증시간이 종료되었습니다.<br>카카오 인증 요청을 재시도해 주세요.';
        isReload = true;
    } else if (errorCode == '100006') {
        msg = '카카오 회원정보 조회에 실패하였습니다.<br>';
        msg += '카카오톡 설정에서 본인인증 후 재시도 해주세요.<br>';
        msg += '<a href="javascript:fnKakaoInfo();">카카오 인증 안내 바로가기</a>';
    } else if (errorCode == '100007') {
        msg = '카카오 인증 중 오류가 발생하였습니다.<br>담당자(02-2290-0207)에게 문의 부탁드립니다.';
        isReload = true;
    } else if (errorCode == '100008') {
        popupType = 'confirm';
        msg = '카카오 인증은 휴대폰 본인인증 완료 후 가능하니<br>';
        msg += '휴대폰 본인인증해 주세요.';
        fnOpenAlertPopup.changeConfirmBtnNm('인증', '취소');
        fnOpenAlertPopup.confirm(title, msg, function (res) {
            if (res) {
                //휴대폰 본인인증
                let params = {};
                params.gubun = 'selfAuth';
                params.userId = KAKAO_AUTH_ID;
                fnPhoneAuth(params);
            }
        });
        return;

    } else if (errorCode == '100009') {
        msg = '비밀번호가 올바르지 않습니다.';
    } else if (errorCode == '100010') {
        msg = '카카오 인증 중 오류가 발생하였습니다.<br>담당자(02-2290-0207)에게 문의 부탁드립니다.<br>에러코드:100010.';
        isReload = true;
    } else if (errorCode == '100011') {
        msg = '카카오 인증 중 오류가 발생하였습니다.<br>담당자(02-2290-0207)에게 문의 부탁드립니다.<br>에러코드:100011.';
        isReload = true;
    } else if (errorCode == '100012') {
        msg = '카카오 인증 후 요청 버튼을 눌러주세요.';
    } else if (errorCode == '100013') {
        msg = '카카오 인증 중 오류가 발생하였습니다.<br>담당자(02-2290-0207)에게 문의 부탁드립니다.<br>에러코드:100013.';
        isReload = true;
    } else if (errorCode.includes('[RE421] 카카오 계정 사용자')) {
        msg = '카카오 회원정보 조회에 실패하였습니다.<br>카카오톡 설정에서 본인인증 후 재시도 해주세요.<br><a href="https://sso.hycu.ac.kr/sso/ManualCtr/kkoInfo.do?tab=1" target="_blank">[카카오인증 안내] 바로가기</a>';
        isReload = true;
    } else if (errorCode.includes('[RE400] 존재하지 않는 계정')) {
        msg = '카카오 회원정보 조회에 실패하였습니다.<br>카카오톡 설정에서 본인인증 후 재시도 해주세요.<br><a href="https://sso.hycu.ac.kr/sso/ManualCtr/kkoInfo.do?tab=1" target="_blank">[카카오인증 안내] 바로가기</a>';
        isReload = true;
    } else if (errorCode.includes('[RE400] 생년월일 누락 혹은 형식')) {
        msg = '계정에 생년월일이 등록되어 있지 않습니다.<br>카카오 로그인을 사용하시려면 정보인프라혁신팀 담당자<br>(02-2290-0207)로 연락 바랍니다.';
        isReload = true;
    } else if (errorCode.includes('[RE400] 휴대폰번호 누락 혹은')) {
        popupType = 'confirm';
        msg = '카카오 인증은 휴대폰 본인인증 완료 후 가능하니<br>';
        msg += '휴대폰 본인인증해 주세요.';
        fnOpenAlertPopup.changeConfirmBtnNm('인증', '취소');
        fnOpenAlertPopup.confirm(title, msg, function (res) {
            if (res) {
                //휴대폰 본인인증
                let params = {};
                params.gubun = 'selfAuth';
                params.userId = KAKAO_AUTH_ID;
                fnPhoneAuth(params);
            }
        });
        return;
    } else if (errorCode.includes('[VE400]')) {
        msg = '유효시간이 종료되었습니다.<br>카카오 인증 요청을 재시도 해주세요.';
        isReload = true;
    }else {
        msg = errorCode;
        isReload = true;
    }

    if(msg != '' && popupType == 'alert'){
        fnOpenAlertPopup.alert(title, msg, function (res) {
            if (res) {     
                if(isReload == true){
                    location.reload();
                }
            }
       });            
    }
}

function fnLoginErrorMsg(errorCode){

    if(!fnCheckValid(errorCode)){
        return;
    }
    
    let title = '알림';
    let msg = '';
    let popupType = 'alert';
    let isReload = false;
    
    msg =  '잘못된 요청('+ errorCode + ')입니다.<br>';
    
    // ENTR
    if(errorCode == '200001'){
        msg += '(유효하지 않은 요청 시도)<br><br>';
        msg += '입학홈페이지에서 로그인하신 후<br>가이드홈을 이용해주세요.';
    }else if(errorCode == '200002'){
        msg += '(만료된 요청 시도)<br><br>';
        msg += '입학홈페이지에서 로그인하신 후<br>가이드홈을 이용해주세요.';
    }else if(errorCode == '200003'){
        msg += '(확인되지 않은 포털 사용자)<br><br>';
        msg += '가이드홈 또는 포털 이용 대상자가 아닙니다.';
    }else if(errorCode == '200004'){
        msg += '(유효하지 않은 요청 시도)<br><br>';
        msg += '한사대로(포털)에서 통합로그인하신 후<br>이용해주세요.';
    }
    
    // AUTO
    if(errorCode == '300001'){
        msg += '(유효하지 않은 요청 시도)<br><br>';
        msg += '자동 로그인 설정을 확인해주세요.';
    }else if(errorCode == '300002'){
        msg += '(만료된 요청 시도)<br><br>';
        msg += '자동 로그인 설정을 확인해주세요.';
    }else if(errorCode == '300003'){
        msg += '(확인되지 않은 포털 사용자)<br><br>';
        msg += '가이드홈 또는 포털 이용 대상자가 아닙니다.';
    }else if(errorCode == '300004'){
        msg += '(유효하지 않은 요청 시도)<br><br>';
        msg += '한사대로(포털)에서 통합로그인하신 후<br>이용해주세요.';
    }
    
    
    if(msg != '' && popupType == 'alert'){
        
        fnOpenAlertPopup.alert(title, msg, function (res) {
            if (res) {     
                if(isReload == true){
                    location.reload();
                }
            }
       });            
    }
}

function fnPKIDelMsg(msgCode){

    if(!fnCheckValid(msgCode)){
        return;
    }
    
    let msg = "";
    
    if(msgCode == '01'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 검증 실패';
    }else if(msgCode == '02'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 인증서 오류';
    }else if(msgCode == '03'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 검증 오류';
    }else if(msgCode == '04'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 서명 검증 오류';
    }else if(msgCode == '05'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 유효기간 오류';
    }else if(msgCode == '06'){
        msg = '만료된 공동인증서입니다.<br>';
        msg += '인증서 재발급 후 등록하여 로그인해 주세요.';
    }else if(msgCode == '07'){
        msg = '폐지된 공동인증서입니다.<br>';
        msg += '인증서 재발급 후 등록하여 로그인해 주세요.';
    }else if(msgCode == '08'){
        msg = '공동인증서 삭제 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
    }else if(msgCode == '09'){
        msg = '학번과 공동인증서 정보가 일치하지 않아<br>';
        msg += '인증서를 등록할 수 없습니다.<br>';
        msg += '학번과 공동인증서 정보를 확인해 주세요.';
    }else if(msgCode == '10'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.<br>';
        msg += '에러코드 : 서명 검증 오류';
    }else if(msgCode == '11'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.<br>';
        msg += '에러코드 : 서명 미존재';
    }else if(msgCode == '12'){
        msg = '미등록된 공동인증서 입니다.<br>';
        msg += '인증서를 등록해 주세요.'
    }else if(msgCode == '13'){
        msg = '공동인증서 삭제 처리중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.<br>';
        msg += '에러코드 : 데이터 오류';
    }else if(msgCode == '14'){
        msg = "공동인증서가 삭제되었습니다.";
    }else if(msgCode == '15'){
        msg = "공동인증서 삭제 처리중 오류가 발생하였습니다.<br>";
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
    }

    fnOpenAlertPopup.alert('알림', msg, function (res) {
          if (res) {      
          }
    });
}

function fnPKIAuthMsg(msgCode){

    if(!fnCheckValid(msgCode)){
        return;
    }
    
    let msg = "";
    
    if(msgCode == '01'){
        msg = '공동인증서가 유효하지 않습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 검증 실패';
    }else if(msgCode == '02'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 인증서 오류';
    }else if(msgCode == '03'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 검증 오류';
    }else if(msgCode == '04'){
        msg = '공동인증서 유효기간 검증에 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
        msg += '에러코드 : 서명 검증 오류';
    }else if(msgCode == '05'){
        msg = '만료된 공동 인증서입니다.<br>';
        msg += '인증서 재발급 후 등록하여 로그인해 주세요.';
    }else if(msgCode == '06'){
        msg = '폐지된 공동 인증서입니다.<br>';
        msg += '인증서 재발급 후 등록하여 로그인해 주세요.';
    }else if(msgCode == '07'){
        msg = '공동 인증 중 오류가 발생하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
    }else if(msgCode == '08'){
        msg = '공동 인증에 실패하였습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
    }else if(msgCode == '09'){
        msg = '공동 인증에 필요한 서명 데이터가 존재하지 않습니다.<br>';
        msg += '담당자(02-2290-0207)에게 문의 부탁드립니다.';
    }

    fnOpenAlertPopup.alert('알림', msg, function (res) {
          if (res) {      
          }
    });
}

function isNumber(key){
    
    let result = false;
    
    switch(key){
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
    case "0":
        result = true;
    default : 
    }

    return result;
}

function fnChangePinLoginForm(formName){

    fnInitPinInfo();
      
    if(formName == 'authForm'){
        $('.auth_form').show();
        $('.register_form').hide();
        $('.login_form').hide();
    }else if(formName == 'registerForm'){
        $('.auth_form').hide();
        $('.register_form').show();
        $('.form_item_footer .register_form').css('display', 'flex');
        $('.login_form').hide();
    }else if(formName == 'loginForm'){
        $('.auth_form').hide();
        $('.register_form').hide();
        $('.login_form').show();
    }
}

function fnLoginFocus(){

    $('#learningLogin').addClass('on');
    
    var list_active = $('#container .form_list .form_item.easy .m_btn');
    list_active.addClass('active');
    
    const popup = window.localStorage.getItem('openPopup');
    
    if(fnCheckValid(popup)){
        if(popup == 'findPw'){
            $('#findPw').focus();
        }else if(popup == 'findId'){
            $('#findId').focus();
        }
        window.localStorage.removeItem('openPopup');
    }else{
        // 간편번호의 경우 서버로부터 유효성 검증을 비동기 방식으로 진행하기 때문에 해당 영역에서 체크하지 않음
        if($.cookie("cookieFocusCheck") == "Living"){
            $('#container .tab .tab_cont_box .form_list.mobile .form_item.living').addClass('active');
            $('#userId').focus();
        }else if($.cookie("cookieFocusCheck") == "Kakao"){
            $('#container .tab .tab_cont_box .form_list.mobile .form_item.kakao').addClass('active');
            $('#loginIdKakao').focus();
        }else if($.cookie("cookieFocusCheck") == "Certificate"){
            $('#container .tab .tab_cont_box .form_list.mobile .form_item.certificate').addClass('active');
            $('#signDataBtn').focus();
        }else if($.cookie("cookieFocusCheck") == "Normal"){
            
            $('#container .tab .tab_btn_box .tab_btn_list li').removeClass('active');
            $('#container .tab .tab_cont_box').removeClass('on');   

            list_active = $('#container .tab_btn_list li[data-tab="defaultLogin"]');
           
            list_active.addClass('active');

            $('#defaultLogin').addClass('on');
            $('#loginIdCom').focus();
        }   
    }
}

function fnMobileRespMyCert(){

    if(RES_SUCCESS_YN == 'Y'){
        
        if(PHONE_NO_UPDATE_YN == 'Y'){  
            fnPhoneAuthResult('updatePhoneNo', PHONE_AUTH_DATA, PHONE_AUTH_GUBUN);
        }else{      
            fnPhoneAuthResult(PHONE_AUTH_GUBUN, PHONE_AUTH_DATA, '');       
        }        
    }else{
        
        if(PHONE_AUTH_GUBUN == 'selfAuth'){
            fnPhoneAuthResult('selfAuthFail','','');
        }else{
            if(SAME_USER_IFNO_YN == 'Y'){
                fnPhoneAuthResult('sameUserInfo','',PHONE_AUTH_GUBUN);
            }else{
                fnPhoneAuthResult('phoneNoMissMatch','',PHONE_AUTH_GUBUN);     
            }
        }       
    }
}

function getCheckBiometric() {
    var getAuthUrl = "smartq://hycu?action=checkBiometric";
    
    //iOS용
    try {
        webkit.messageHandlers.callbackHandler.postMessage(getAuthUrl);
    } catch(err) {
    }
    //Android용
    try {
        window.Android.goScheme(getAuthUrl);
    } catch(err) {
    }
} 

function getAuth() {
    var getAuthUrl = "smartq://hycu?action=getAuth&id=" + $("#lgid").val();
    
    //iOS용
    try {
        webkit.messageHandlers.callbackHandler.postMessage(getAuthUrl);
    } catch(err) {}
    //Android용 
    try {
        window.Android.goScheme(getAuthUrl);
    } catch(err) {}      
}

function goBiometric() {
    var getAuthUrl = "smartq://hycu?action=goBiometric&id=" + $("#lgid").val();

    //iOS용
    try {
        webkit.messageHandlers.callbackHandler.postMessage(getAuthUrl);
    } catch(err) {
    }
    //Android용    
    try {
        window.Android.goScheme(getAuthUrl);
    } catch(err) {
    }
}

//생체인증 로그인 에러처리 관련
/*
    성공시 형태,
    {"isSuccess":"Y","errorCode":"1004","type":"ID","id":"AAA","errorMessage":"성공","action":"goBiometric"}
     
    실패시 형태,
    {"errorCode":"1013","id":"AAA","action":"goBiometric","errorMessage":"등록되지 않음","isSuccess":"N"}
     
    생체인증 시도 시 발생할 수 있는 에러코드 는 아래와 같습니다.
     
    SUCCESS("성공", 1004),
    CANCEL("취소", 1007),
    FAIL("실패", 1008),
    NOT_EXIST_USER("등록되지 않은 사용자", 1010),
    NO_PARAM("파라미터 없음", 1011),
    NOT_SUPPORT("지원되지 않음", 1012),
    //NOT SUPPORT 는 기기에서 지원하지 않는  케이스 
    NOT_REGIST("등록되지 않음", 1013),
    UNKNOWN_ERROR("알수 없는 에러", 1014),
    NOT_REGIST_BIO("생체인증 없음", 1015), 
    //NOT_REGIST_BIO 는 기기에서 지원하지만 등록을 하지 않은 경우
    LOCK_BIO("생체인증 잠김", 1016),
    NETWORK_ERROR("네트워크 오류", 1018);
*/
function smartQAppCallback(data){
    var response = JSON.parse(data);
    console.log('>> appCallback data start');
    console.log(response.action);
    console.log(response.errorCode);
    console.log('>> appCallback data end');

    if (response.action == "checkBiometric") {
        if (response.errorCode == "1004" ){
            getAuth();
        } else if (response.errorCode == "1012") {
            fnOpenAlertPopup.alert('알림', '생체인증을  지원하지 않는<br> 기기입니다. [안내코드: A1012]', function (res) {
                if (res) {      
                }
            });
        } else if (response.errorCode == "1015") {
            fnOpenAlertPopup.alert('알림', '생체인증 로그인 설정이 되어 있지<br> 않습니다. 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: A1015]', function (res) {
                if (res) {      
                }
            });
        }else if (response.errorCode == "1016") {
            fnOpenAlertPopup.alert('알림', '기기 생체인증이 잠겨있습니다. 잠시후 다시 시도하세요. [안내코드: A1016]', function (res) {
                if (res) {      
                }
            });
        }else if (response.errorCode == "1014" && response.originErrorCode == "-5") {
            fnOpenAlertPopup.alert('알림', 'iOS기기의 경우, 설정 > FACE ID 및 암호 > 암호 켜기 활성화 이후에 사용이 가능합니다. [안내코드: A1014]', function (res) {
                if (res) {      
                }
            });
        }
    }else if (response.action == "getAuth") {
        if (response.errorCode == 1004 ){
            if(response.type=="BO") {
                goBiometric();
            } else {
                fnOpenAlertPopup.alert('알림', '생체인증 로그인 설정이 되어 있지<br> 않습니다. 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: B1004]', function (res) {
                    if (res) {      
                    }
                });
            }
        }
        else{
            //예외처리
            if (response.errorCode == "1005") { /* no data */
                fnOpenAlertPopup.alert('알림', '생체인증 관련 정보가 없습니다.<br> 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: B1005]', function (res) {
                    if (res) {
                    }
                });
            } else if (response.errorCode == "1011") { /* 파라미터 없음 */
                fnOpenAlertPopup.alert('알림', '생체인증 관련 정보가 없습니다.<br> 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: B1011]', function (res) {
                    if (res) {
                    }
                });
            } else if (response.errorCode == "1013") { /* 등록되지 않음 */
                fnOpenAlertPopup.alert('알림', '생체인증 로그인 설정이 되어 있지<br> 않습니다. 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: B1013]', function (res) {
                    if (res) {
                    }
                });
            } else if (response.errorCode == "1015") { /*기기에서 지원하지만 등록을 하지 않은 경우*/
                fnOpenAlertPopup.alert('알림', '생체인증 로그인 설정이 되어 있지<br> 않습니다. 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: B1015]', function (res) {
                    if (res) {
                    }
                });
            }else if (response.errorCode == "1016") { /* 생체인증이 잠겨있을 경우 */
                fnOpenAlertPopup.alert('알림', '생체인증이 잠겨 있습니다. [안내코드: B1016]', function (res) {
                    if (res) {
                    }
                });
            }else if (response.errorCode == "1014" && response.originErrorCode == "-5") {
                fnOpenAlertPopup.alert('알림', 'iOS기기의 경우, 설정 > FACE ID 및 암호 > 암호 켜기 활성화 이후에 사용이 가능합니다. [안내코드: B1014]', function (res) {
                    if (res) {
                    }
                });
            }else {
                var orgErrCode = response.originErrorCode;
                var msg = 'getAuth errorCode : [error code '+response.errorCode+']';
                if(orgErrCode) {
                    msg += '<br/>[' + orgErrCode + ']';
                }
                fnOpenAlertPopup.alert('알림', msg, function (res) {
                    if (res) {      
                    }
                });
            }
        }
    }else if (response.action == "goBiometric") {
        if (response.errorCode == 1004){
            // 로그인 시도
            console.log('로그인 시도');
            $("#sessionUserId").val(response.userId);
            $("#sessionSite").val($("#site").val());
            $("#sessionDeviceId").val(response.deviceId);
            // $("#sessionForm").submit();

            // 직원, 조교가 외부망에서 접속 시 IP 체크
            // App 에서 생체인증 후 callback 부분
            if (parent.checkIP("fido") === "false") {
                // MFA gubun 변경
                $("#mfaGubun").val("fido"); // 생체인증

                // 팝업을 표시하고 완료 버튼 클릭을 기다림
                $("#popup_mfa").css('display',
                    'flex').focus();
                // $("#loginIdMfa").val(response.userId); // 팝업 내에 학번저장 기능 추가(2025-09-01)
                // $("#loginPwdMfa").focus();
            } else {
                // 교수, 학생인 경우 외부망 체크 skip
                $("#sessionForm").submit();
            }
        }
        else if(response.errorCode == 1007){
            // 지문인식 창에서 사용자가 x버튼 눌러서 취소
            console.log('지문인식 창에서 사용자가 x버튼 눌러서 취소 [안내코드: C1007]');
        }
        else{
            //예외처리
            if (response.errorCode == "1005") { /* no data */
                fnOpenAlertPopup.alert('알림', '생체인증 관련 정보가 없습니다.<br> 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: C1005]', function (res) {
                    if (res) {      
                    }
                });
            } else if (response.errorCode == "1011") { /* 파라미터 없음 */
                fnOpenAlertPopup.alert('알림', '생체인증 관련 정보가 없습니다.<br> 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: C1011]', function (res) {
                    if (res) {      
                    }
                });
            } else if (response.errorCode == "1013") { /* 등록되지 않음 */
                fnOpenAlertPopup.alert('알림', '생체인증 로그인 설정이 되어 있지<br> 않습니다. 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: C1013]', function (res) {
                    if (res) {      
                    }
                });
            } else if (response.errorCode == "1015") {/*기기에서 지원하지만 등록을 하지 않은 경우*/
                fnOpenAlertPopup.alert('알림', '생체인증 로그인 설정이 되어 있지<br> 않습니다. 학번정보로 로그인 후<br> 설정하실 수 있습니다. [안내코드: C1015]', function (res) {
                    if (res) {      
                    }
                });
            }else if (response.errorCode == "1016") { /* 생체인증이 잠겨있을 경우 */
                fnOpenAlertPopup.alert('알림', '생체인증이 잠겨 있습니다. [안내코드: C1016]', function (res) {
                    if (res) {      
                    }
                });
            }else if (response.errorCode == "1014" && response.originErrorCode == "-5") {
                fnOpenAlertPopup.alert('알림', 'iOS기기의 경우, 설정 > FACE ID 및 암호 > 암호 켜기 활성화 이후에 사용이 가능합니다. [안내코드: C1014]', function (res) {
                    if (res) {      
                    }
                });
            }
            else {
                var orgErrCode = response.originErrorCode;
                var msg = 'getAuth errorCode : ' + response.errorCode;
                
                if(orgErrCode) {
                    msg += '<br/>[' + orgErrCode + ']';     
                }
                
                fnOpenAlertPopup.alert('알림', msg, function (res) {
                    if (res) {      
                    }
                });
            }
        }
    }else if (response.action == "checkApp") {
        if (response.errorCode == 1004 ) {
            loginKKO();
        } else {
            fnOpenAlertPopup.alert('알림', '본인인증을 진행하려면<br>카카오톡을 설치해주세요.', function (res) {
                if (res) {     
                    var userAgent = navigator.userAgent;
                    if(userAgent.match(".*Android.*")){
                        // 앱 / 안드로이드
                        location.href = 'https://play.google.com/store/apps/details?id=com.kakao.talk';      
                    }else if(userAgent.match(".*iPhone.*") || userAgent.match(".*iPad.*")){
                        // 앱 / IOS
                        setTimeout( function () {
                        location.href = "https://apps.apple.com/kr/app/kakaotalk/id362057947";                        
                        } ,0 );
                    }
                }
            });
        }
    }
}

function fnReqKakaoAuth(){

    var params = {};
    params.persNo = $('#loginIdKakao').val();
    params.txId = $('#txId').val();
    $.ajax({
        url : HYCU_SSO_FIDO_URL+"/com/KcerCtr/loginState.do",
        data : params,
        type : 'post',
        dataType : 'json',
        async : false,
        success : function(rslt) {
              // 카카오 검증 성공
            const status = rslt.status;

            if(status == 'SUCCESS'){
                if($('#txId').val() == rslt.txId){
                    var from = document.getElementById('formKakao');
                    from.action = HYCU_SSO_FIDO_URL+"/com/KcerCtr/loginVerify.do";
                    from.submit();
                }else{
                    fnOpenAlertPopup.alert('알림', '카카오 인증 검증에 실패하였습니다.<br>'+
                            '잠시 후 다시 시도해 주세요.', function (res) {
                        if (res) {
                            location.reload();
                        }
                    });
                }
            }else{
                // 실패
                fnKakaoErrorMsg(rslt.errCode);
            }

        }, error : function(requst, status) {
            fnOpenAlertPopup.alert('알림', '카카오 인증 검증에 실패하였습니다.<br>'+
                    '잠시 후 다시 시도해 주세요.', function (res) {
                if (res) {
                    location.reload();
                }
            });
        }
    });
}

var checkDate = new Date();

function reqIDPSessionExtension(){

    const nowDate = new Date();

    const processTime = ((nowDate - checkDate) / 1000);

    console.log(processTime);

    if(processTime >=(60 * 1)){

        getTime().done(function(data){
            alert(data);
        });

        checkDate = Date.now();
    }
}

