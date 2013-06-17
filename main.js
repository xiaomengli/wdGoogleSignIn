var globalGoogleAPIs = {

    loadDefer :  $.Deferred(),

    signCallbackDefer : $.Deferred(),
    
    signInCallback : function(authData) {
        globalGoogleAPIs.signCallbackDefer.resolve(authData);

        return globalGoogleAPIs.signCallbackDefer.promise();    
    }
};



function googleAPIOnload() {
    globalGoogleAPIs.loadDefer.resolve('loaded');

    return globalGoogleAPIs.loadDefer.promise();
}


(function() {
    function wdGoogleSignIn() {
        var readyDefer = $.Deferred();
        var loopGetDevicesTimer = null;
        var signOutUrl = 'https://accounts.google.com/o/oauth2/revoke';
        var getDevicesUrl = 'http://192.168.100.24:8081/apppush/limbo';
        var signOutRetryTimes = 3;
        var getDevicesRetryTimes = 3;

        this.authData = {};
        this.currentDevice = null;
        this.onlineDeviceList = [];

        function setAuthData(data) {
            if (data) {
                window.localStorage.setItem('google_token', data.access_token ? data.access_token : '');
                this.authData = data;
            }
        }

        return {
            ready : function() {
                return readyDefer.promise();
            },

            render : function() {
                var signinBtns = $('.sign-in');
                var gapi = window.gapi;

                _.each(signinBtns, function(item) {
                    gapi.signin.render(item, {
                      'callback': globalGoogleAPIs.signInCallback,
                      'clientid': '592459906195-7sjc6v1cg6kf46vdhdvn8g2pvjbdn5ae.apps.googleusercontent.com',
                      // 'cookiepolicy': 'http://snappea.com',
                      'cookiepolicy': 'http://localhost',
                      'apppackagename': 'com.snappea',
                      'scope': 'https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/userinfo.email'
                    });
                })
            },

            signInCallback : function(authData) {
                setAuthData.call(this, authData);

                if (authData.access_token) {
                    this.getAccount();
                    this.getDevices();

                    readyDefer.resolve('ready');
                } else if (authData.error) {
                    readyDefer.reject('error');
                }

            },

            signIn : function() {
                this.signInCallback(this.authData);
            },

            signOut : function() {
                var defer = $.Deferred();

                var revokeUrl = signOutUrl + '?token=' + this.authData.access_token;
                var requestReovke = function() {
                    $.ajax({
                        type: 'GET',
                        url: revokeUrl,
                        dataType: 'jsonp',
                        success: function() {
                            setAuthData({});
                            this.currentDevice = null;
                            this.onlineDeviceList = [];

                            signOutRetryTimes = 3;

                            defer.resolve('sign out');
                        },
                        error: function(e) {
                            if(signOutRetryTimes) {
                                requestReovke.call(this);
                            } else {
                                defer.reject(e);                    
                            }

                            signOutRetryTimes = signOutRetryTimes - 1;
                        }
                    });  
                }
                
                requestReovke.call(this);

                return defer.promise();
            },

            getAuthData : function () {
                if (!this.authData.access_token) {
                    this.authData.access_token = window.localStorage.getItem('google_token');
                }

                return this.authData;
            },

            getDevices : function() {
                var defer = $.Deferred();
                var url =  getDevicesUrl + '?google_token=' + this.authData.access_token;
                var requestDevices = function() {
                    $.ajax({
                        type: 'GET',
                        url: url,
                        dataType: 'jsonp',
                        success: function(data) {
                            defer.resolve(data);

                            getDevicesRetryTimes = 3;
                        },
                        error: function(e) {
                            if (getDevicesRetryTimes) {
                                requestDevices.call(this);
                            } else {
                                defer.reject(e);
                            }

                            getDevicesRetryTimes = getDevicesRetryTimes - 1;
                        }
                    });   
                }
            
                requestDevices.call(this);                

                return defer.promise();
            },

            getCurrentDevice : function() {
                return this.currentDevice;
            },

            getOnlineDeviceList : function() {
                return this.onlineDeviceList;
            },

            loopLinkDevices : function() {
                var self = this;
                var isConnectDevice = false;
                var loopGetDevicesTimer = null;
                var getDevices = function() {
                    this.getDevices().done(function(devices) {

                        switch (devices.length) {
                            case 0 : 
                                this.currentDevice = null;
                                this.onlineDeviceList = [];
                                break;
                            case 1 :
                                if (!isConnectDevice) {
                                    isConnectDevice = true;
                                    this.currentDevice = devices[0];
                                } else if (devices[0] !== currentDevice) {
                                    this.currentDevice = devices[0];
                                    this.onlineDeviceList = devices;
                                }
                                break;
                            default : 
                                this.onlineDeviceList = devices;
                                break;
                        }

                        if (!loopGetDevicesTimer) {
                            clearInterval(loopGetDevicesTimer);
                        }
                        loopGetDevicesTimer = setInterval(function() {
                            getDevices.call(self);
                        }, 10000);

                    }).fail(function(errorInfo) {
                        console.log('get devices error');
                        getDevices();
                    });   
                }
                getDevices.call(self);
            },

            stopLoopLinkDevices : function() {
                if (loopGetDevicesTimer) {
                    clearTimeout(loopGetDevicesTimer);
                }
            },

            getAccount : function() {
                var defer = $.Deferred();
                gapi.auth.setToken(this.authData);
                gapi.client.load('oauth2', 'v2', function() {
                    var request = gapi.client.oauth2.userinfo.get();
                    request.execute(function(accountInfo) {
                        defer.resolve(accountInfo);
                    });
                });

                return defer.promise();
            }
        }
    }

    var wdGoogleSignInObj;
    var factory = _.extend(function() {}, {
            getInstance : function() {
                if (!wdGoogleSignInObj) {
                    wdGoogleSignInObj = new wdGoogleSignIn();

                    globalGoogleAPIs.loadDefer.done(function() {
                        wdGoogleSignInObj.render();
                    });

                    globalGoogleAPIs.signCallbackDefer.done(function(authData) {
                        wdGoogleSignInObj.signInCallback(authData);
                    });
                }
                return wdGoogleSignInObj;
            }
        });

    window.wdGoogleSignInFactory = factory;
})();

