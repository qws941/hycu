var checkStatusInterval;
var checkInterval = 3 ;
var checkMaxInterval = 180 ;
var checkTermInterval = 0 ;
/**
* jqGrid
* desc   : form의 데이터를 json 형태로 변환해 준다.
* return : 성공시에는 객체(JSON)을 리턴한다. 실패시에는 null을 리턴한다.
*/
var fidoErrorDic = {}

fidoErrorDic['9025'] = "휴대폰 한사대로 앱에서 생체정보를 등록 후 이용 가능합니다." ;

jQuery.fn.serializeObject = function() {
    var obj = null;
    try {
        if ( this[0].tagName && this[0].tagName.toUpperCase() == "FORM" ) {
            var arr = this.serializeArray();
            if ( arr ) {
                obj = {};
                jQuery.each(arr, function() {
                    obj[this.name] = this.value;
                });
            }//if ( arr ) {
        }
    }catch(e) {
    } 
    finally  {}
    return obj;
};  

function regReady(){
    var jsonObj = JSON.stringify($("#form").serializeObject()); 
    var authCode;
    var returnStatus;
    var qrcode;
    $('#qrcode').empty();
    
    if($("#userId").val() == ""){
        fnOpenAlertPopup.alert('알림', '학번을 입력하세요.', function (res) {
            if (res) {      
            }
        });
        return false;
    } else if($("#site").val() == ""){
        fnOpenAlertPopup.alert('알림', '학번을 입력하세요.', function (res) {
            if (res) {      
            }
        });
        return false;
    }
    
    $.ajax({
        url             :  fidoUrl + "RegReady.jspx"
        , contentType   : "application/json; charset=UTF-8"
        , type          : "post" 
        , dataType      : "json" 
        , data          : jsonObj
        , success       : regFidoSuccess 
        , error         : regFidoError
    });
}

function regFidoSuccess(data, status){
    authCode        = data["AUTHCODE"];
    returnStatus    = data["STATUS"];
    
    $.isLoading({text:"스마트폰에 FIDO 인증앱 실행을 요청하였습니다.<br>스마트폰 FIDO 앱을 실행하여 [인증코드 : "+authCode+"]를 입력 후 등록을 진행하여 주시기 바랍니다.<br><a href='javascript:federationStop();'>[취소하기]</a>", position:"overlay"});
    var serverURL = "${serverDomain}";  
    qrcode = "qrcode{'funcType':'R', 'authcode':'"+ authCode +"', 'userName':'"+ $("#userId").val() +"', 'siteid':'"+ $("#site").val() +"'}";
    $('#qrcode').qrcode({size: 150, text: qrcode});
    
    if(returnStatus != "1200"){
        // alert(returnStatus);
        $.isLoading("hide");
        $('#qrcode').empty();
        var errorMsg = fidoErrorDic[returnStatus] ;
        if(errorMsg == null){
            fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>'+
            		'담당자(02-2290-0207)에게 문의 부탁드립니다.', function (res) {
                if (res) {      
                }
            });
        } else {
        	 fnOpenAlertPopup.alert('알림', errorMsg, function (res) {
                 if (res) {      
                 }
             });
        }
        return;
    } else {
        checkStatus();
        checkStatusInterval = setInterval(function(){
            checkStatus();
        }, 1000 * checkInterval); //10분 
    }   
}

function regFidoError(data, status){
    fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>'+
    		'담당자(02-2290-0207)에게 문의 부탁드립니다.', function (res) {
        if (res) {   
            $('#qrcode').empty();
        }
    });
    return;
}

// FIDO 로그인 함수 
function authReady(){   

    // $.cookie("cookieFocusCheck", "Living", {path: "/", domain: location.hostname, expires : 30 });
    $.cookie("cookieFocusCheck", "Living", {path: "/", domain: ".hycu.ac.kr", expires : 30});
    
    if($("input[id=cookieLoginCheckKakao]").is(":checked")){
        // 쿠키 설정
        $.cookie("cookieLoginCheckKakao", "Y", {path: "/", domain: location.hostname, expires : 30 });
        $.cookie("loginId", $("#userId").val(), {path: "/", domain: location.hostname, expires : 30});
    } else {
        $.cookie("cookieLoginCheckKakao", "N", {path: "/", domain: location.hostname, expires : 30});
    }
    
    //var jsonObj = JSON.stringify($("#fidoForm").serializeObject());

    /*
    var params = {};
    params.gubun = 'fido';
    params.persNo = loginId;
    $.ajax({
        type:"POST",
        // deviceId는 클라이언트에서 전송, pushMsg에는 QR코드 내용이 들어가야 함, authCode는 옵션
        data : params
        ,dataType : "json"
        ,url: "/sso/LoginCtr/authReady.do"
        ,success: authSuccessUser
        ,error : authErrorUser
    });
    */
    
    fnCheckUserInfo($("#userId"), 'none', 'none', 'none', 'fido', true);
}

// 사용자 아이디 인증 
function authSuccessUser(data){
    
    var retVAL = data["retVAL"];
    
    if(retVAL == "isUserIdExist"){          
        var jsonObj = JSON.stringify($("#fidoForm").serializeObject());
    //  if($('input[name="chkUserId"]:checked').val() == "Y"){  
        if(true){   // 아이디 없는 인증은 주석으로 인하여 무조건 true / 아이디 없는 인증 진행시 아래 radio 버튼 주석 해지 및 위의 if 문 주석문으로 대체
            var authCode;
            
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
            
            
        //아이디 없을 경우 ( 사용하지 않음 )
        } else {
            /*
            $.isLoading({text:"스마트폰에 FIDO 인증앱 실행을 요청하였습니다.<br>스마트폰 FIDO 앱을 실행하여 인증을 진행하여 주시기 바랍니다.<br><a href='javascript:federationStop();'>[취소하기]</a>", position:"overlay"});
            qrcode = "qrcode{'funcType':'A','requrl':'" + $("#requrl").val() + "', 'authcode':'" + $("#authCode").val() + "', 'siteid':'" + $("#site").val() + "'}";                    
            $('#qrcode').qrcode({size: 150, text: qrcode});
            */
            $.ajax({
                type:"POST"
                // deviceId는 클라이언트에서 전송, pushMsg에는 QR코드 내용이 들어가야 함, authCode는 옵션
                    ,contentType : "text/html;charset=UTF-8"
                ,url: fidoUrl + "authRequest.jsp"
                ,beforeSend:function(xhr){
                    xhr.setRequestHeader("did",$("#deviceId").val());
                    xhr.setRequestHeader("company",$("#site").val());
                    xhr.setRequestHeader("authcode",$("#authCode").val());
                }
                ,success: authNoUserIdSuccess
                ,error : authNoUserIdError
                
            });
        }
    } else if(retVAL == "isExpelledStd"){
        fnOpenAlertPopup.alert('알림', '제적생은 로그인 할 수 없습니다.<br>'+
        		'※ 제적생 증명서 발급은 <a href="https://www.hycu.ac.kr/user/unGdInfo/goMain/certificate/certificate.do" target="_blank">[인터넷증명센터]</a> 이용', function (res) {
            if (res) {      
                $("#userId").focus();
            }
        });
        return false;    //check
    } else if(retVAL == "isNotExist"){
        // ISMS 조치사항 20240418
        //fnOpenAlertPopup.alert('알림', '입력하신 학번을 확인해 주세요.<br><br>'+
        fnOpenAlertPopup.alert('알림', '입력하신 학번/비밀번호를 확인해주세요.<br><br>'+
    			'※재학생인 경우 <a href="#" onclick="fnReqOpenPopup(\'findId\', \'Y\');">[학번 찾기]</a> 진행<br>'+
    			'※신,편입생인 경우 학적 생성 전까지는<br>'+ 
    			'<a href="https://go.hycu.ac.kr" target="_blank">[입학홈페이지]</a>이용', function (res) {
            if (res) {      
                $("#userId").focus();
            }
        });
    }else{
    	fnOpenAlertPopup.alert('알림', '로그인 처리 중 오류가 발생했습니다.<br>잠시 후 다시 시도하세요.', function (res) {
            if (res) {      
                $("#userId").focus();
            }
        });
    }
}

function authErrorUser(){
    fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다. 재시도해주시기 바랍니다.', function (res) {
        if (res) {     
//            $('#divQRView').hide();
        	fnFidoPopupClose();
            // alert("code = "+ request.status + " message = " + request.responseText + " error = " + error); // 실패 시 처리
        }
    });
    return false;
}


// FIDO 아이디 인증 성공 
function authSuccess(data){ 
    // console.log(data);
    authCode = data["AUTHCODE"];
    returnStatus = data["STATUS"];
//    layer_popup($("#divQRView"));
    fnOpenPopup('divQRView');
    
    // $.isLoading({text:"스마트폰에 FIDO 인증앱 실행을 요청하였습니다.<br>스마트폰 FIDO 앱을 실행하여 인증을 진행하여 주시기 바랍니다.<br><a href='javascript:federationStop();'>[취소하기]</a>", position:"overlay"});
    var qrcode = "" ;
    qrcode = "qrcode{'funcType':'A','requrl':'"+ $("#requrl").val() +"', 'authcode':'" + $("#authCode").val() + "', 'userName':'"+ $("#userId").val() +"', 'siteid':'"+ $("#site").val() +"'}"; 
 
    $('#qrcode').empty();
    $('#qrcode').qrcode({size: 150, text: qrcode});
    
    if(returnStatus != "1200"){
        
        var errorMsg = fidoErrorDic[returnStatus] ;
        fnFidoPopupClose();
        
        if(errorMsg == null){
        	fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>'+
            		'담당자(02-2290-0207)에게 문의 부탁드립니다.', function (res) {
                if (res) {   
                	location.reload();
                    
                }
            });
        	return;
        } else {        	
            fnOpenAlertPopup.alert('알림', errorMsg, function (res) {
                if (res) {     
                	location.reload();
                }
            });
            return;
        }

    }else{
        $('#dscertContainer').hide();
        
        // 인증 시간 보여주기 위한 타이머
        fnSetTimer(60 * 3, '03', '00');
        fnTimer($('#timerForQR'));
        
        checkStatus();
        checkStatusInterval = setInterval(function(){checkStatus();}, 1000 * checkInterval); //3초 
    }
}

//FIDO 아이디 인증 실패
function authError(request,status,error){
	fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>'+
    		'담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
    		'에러코드 : 아이디 인증 실패', function (res) {
        if (res) {   
        	fnFidoPopupClose();
        }
    });
    return;
}

function authNoUserIdSuccess(data, status, xhr){
    if(xhr.getResponseHeader("uid") != ''){
        $("#userId").val(xhr.getResponseHeader("uid"));
        //$('input:radio[name="chkUserId"][value="Y"]').prop('checked', true);
        authReady();
    }else{
    	fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>'+
        		'담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
        		'에러코드 : 아이디 인증 실패', function (res) {
            if (res) {   
            }
        });
        return false;   //check
    }
}

function authNoUserIdError(data){
   
    fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>'+
    		'담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
    		'에러코드 : 아이디 인증 실패', function (res) {
        if (res) {   
        }
    });
    return false;   //check
}

function DeRegReady() {
    var jsonObj = JSON.stringify($("#form").serializeObject());

    var authCode;
    $.ajax({
        type:"POST",
        // deviceId 는 반드시 입력, Client App을 거치치 않고 Fido Server로 해지 처리 바로 요청, 요청한 장치에 대해서만 해지 처리
        data : jsonObj,
        dataType : "JSON",
        contentType : "application/json; charset=UTF-8",
        url: fidoUrl + "DeRegReady.jspx",
        success:function (data) {
            authCode = data["AUTHCODE"];
            returnStatus    = data["STATUS"];
            
            $.isLoading({text:"스마트폰에 FIDO 인증앱 실행을 요청했습니다.<br>스마트폰 FIDO 앱을 실행하여 해지를 진행해 주세요.<br><a href='javascript:federationStop();'>[취소하기]</a>", position:"overlay"});
            
            if(returnStatus != "1200"){
                alert(returnStatus);
                $.isLoading("hide");
                return;
            }else{
                checkStatus();
                checkStatusInterval = setInterval(function()
                {
                        checkStatus();
                }, 1000 * checkInterval); //10분 
            }
        },
        error :function () {
            fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>잠시 후 다시 시도해주세요.', function (res) {
                if (res) {      
                }
            });
            return;
        },
        beforeSend: function(){
            if($("#userId").val() == ""){
                fnOpenAlertPopup.alert('알림', '학번를 입력하세요.', function (res) {
                    if (res) {      
                    }
                });
                return false;
            } else if($("#site").val() == ""){
                fnOpenAlertPopup.alert('알림', '생체인증 중 오류가 발생하였습니다.<br>'+
                		'담당자(02-2290-0207)에게 문의 부탁드립니다.<br>'+
                		'에러코드 : 유저 오류', function (res) {
                    if (res) {      
                    }
                });
                return false;
            }
        }       
    });
}  


function checkStatus() {
    var jsonObj = JSON.stringify($("#fidoForm").serializeObject());
    var successAlertMsg = "";
    var errorAlertMsg = "";
    var failAlterMsg = "";  
    console.log("checkStatus(" + fidoUrl + ")");
    if(checkMaxInterval > checkTermInterval){
        checkTermInterval += checkInterval ;

        $.ajax({
            type:"POST",
            data : jsonObj,
            dataType : "JSON",
            contentType : "application/json; charset=UTF-8",
            url: fidoUrl + "checkStatus.jspx",
            success:function (data) {
                console.log(data);
                switch(data["REQTYPE"]){
                case "REG":
                    successAlertMsg = "등록이 완료되었습니다.";
                    errorAlertMsg = "스마트 폰에서 FIDO 사용자 등록 처리중<br>오류가 발생하였습니다.<br>잠시 후 다시 시도해주세요.";
                    failAlterMsg = "올바른 인증번호를 입력하세요.";
                    break;
                case "AUTH":
                    successAlertMsg = "인증되었습니다.";
                    errorAlertMsg = "스마트 폰에서 FIDO 인증 처리중<br>오류가 발생하였습니다.<br>잠시 후 다시 시도해주세요.";
                    failAlterMsg = "올바른 인증번호를 입력하여 주세요.";
                    break;
                case "DEREG":
                    successAlertMsg = "사용자의 인증장치가 해지되었습니다.";
                    errorAlertMsg = "스마트 폰에서 FIDO 사용자 해지 처리중<br>오류가 발생하였습니다.<br>잠시 후 다시 시도해주세요.";
                    failAlterMsg = "올바른 인증번호를 입력하여 주세요.";
                    break;
                }
                if(data["STATUS"] == 'CONFIRM') {
                    
                    clearInterval(checkStatusInterval);
                    
                    if(data["REQTYPE"] == "AUTH"){
                        /* if(data["SESSIONCHECK"] != "true"){
                             return;
                         }*/
                    	nextProcess(data);
                    }                         
                    
                } else if(data["STATUS"] == 'ERROR') {
                    //fnOpenAlertPopup.alert('알림', errorAlertMsg, function (res) {
                        //if (res) {
                          location.reload();  
                        //}
                    //});
                } else if(data["STATUS"] == 'FAIL') {
                    //fnOpenAlertPopup.alert('알림', failAlterMsg, function (res) {
                        //if (res) {
                            location.reload();
                        //}
                    //});
                }
            },
            error :function () {
                //alert("데이터를 불러오는데 실패하였습니다.");
                //로그아웃
                //  logout();
            }
        });
    } else {
        // 경과 기간 초과
        clearInterval(checkStatusInterval);
        fnOpenAlertPopup.alert('알림', '인증 유효시간이 종료되었습니다.<br>인증 요청을 재시도해 주세요.', function (res) {
            if (res) { 
                location.reload();
            }
        });
    }
}

function nextProcess(data) {

    fnFidoPopupClose();
    $("#sessionUserId").val($("#userId").val());
    $("#sessionSite").val($("#site").val());
    $("#sessionDeviceId").val(data["DEVICEID"]);

    // 직원, 조교가 외부망에서 접속 시 2차 인증하도록 팝업
    // 생체인증 PC 브라우저에서 진행
    if (checkIP("fido") === "false") {
        // MFA gubun 변경
        $("#mfaGubun").val("fido"); // 생체인증

        // 팝업을 표시하고 완료 버튼 클릭을 기다림
        $("#popup_mfa").css('display',
            'flex').focus();
        // $("#loginIdMfa").val($("#userId").val()); // 팝업 내에 학번저장 기능 추가(2025-09-01)
        // $("#loginPwdMfa").focus();
    } else {
        // 교수, 학생인 경우 외부망 체크 하지않고 skip
        $("#sessionForm").submit();
    }

}

function federationStop() {
    var jsonObj = JSON.stringify($("#fidoForm").serializeObject());
    checkTermInterval = 0 ;
    $.ajax({
        type:"POST",
        data : jsonObj,
        dataType : "JSON",
        contentType : "application/json; charset=UTF-8",
        url: fidoUrl + "federationStop.jspx",
        success:function (data) {
            if(data["STATUS"] == 'FAIL') {
                fnOpenAlertPopup.alert('알림', '취소 요청에 실패했습니다.', function (res) {
                    if (res) {      
                    }
                });
            } else if(data["STATUS"] == 'SUCCESS') {
                clearInterval(checkStatusInterval);
                location.reload();
                /*fnOpenAlertPopup.alert('알림', '취소 요청에 성공했습니다.', function (res) {
                    if (res) { 
                        location.reload();
                    }
                });*/
            }
        },
        error :function () {
            //alert("데이터를 불러오는데 실패하였습니다.");
            //로그아웃
            //  logout();
        }
    });
}

function fnFidoPopupClose(){
	$('#qrcode').empty();
	$('#divQRView').css('display', 'none');
	fnTimeOut();
}