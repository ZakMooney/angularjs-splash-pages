'use strict';

var app = angular.module('ctLoginsApp.logins.directives', []);

app.directive('formCode', ['$q', '$sce', '$timeout', 'Client', '$routeParams', '$location', '$window', '$compile', '$localStorage', '$rootScope', 'CT',
  function($q, $sce, $timeout, Client, $routeParams, $location, $window, $compile, $localStorage, $rootScope, CT) {

  var link = function(scope,element,attrs) {

    scope.submit = function(custom_data) {
      if (scope.loggingIn) {
        return;
      }
      scope.loggingIn = true;
      if ($routeParams.preview === 'true') {
        scope.preview = 'This is just a preview, you cannot actually login.';
      } else {
        scope.error = undefined;
        $rootScope.banneralert = undefined;
        $rootScope.error = undefined;
        scope.state.hidden = true;
        scope.state.status = 'login';
        if (custom_data && custom_data.fields) {
          scope.fields = custom_data.fields;
        }
        CT.login({
          email:      scope.email,
          username:   scope.username,
          password:   scope.password,
          logincode:  scope.logincode,
          newsletter: scope.newsletter,
          splash_id:  $routeParams.splash_id,
          data: scope.fields
        }).then(onSuccess, onFail);
      }
    };

    var onSuccess = function(auth) {
      if ( auth !== undefined && auth.type === 'ruckus' ) {
        loginRuckus(auth);
      }
      else if ( auth !== undefined && auth.type === 'microtik' ) {
        loginMicrotik(auth);
      } else {
        finishLogin();
      }
    };

    var onFail = function(err) {
      // Insert a CT service error handler //
      cleanUp();
      $rootScope.banneralert = 'banner-alert alert-box alert';
      $rootScope.error = err;
      chooseForm();
    };

    var finishLogin = function() {
      cleanUp();
      scope.success = true;
      CT.reporter().then(redirectUser);
    };

    var loginRuckus = function(auth) {
      Client.details().then(function(client) {
        var openUrl = 'http://' + client.uamip + ':' + client.uamport +'/login?username='+ auth.username +'&password=' + auth.password;
        scope.detailFrame =  $sce.trustAsResourceUrl(openUrl);
        $timeout(function() {
          finishLogin();
        },2000);
      });
    };

    var loginMicrotik = function(auth) {
      Client.details().then(function(client) {
        var openUrl = client.uamip + '?username='+ auth.username +'&password=' + auth.password;
        scope.detailFrame =  $sce.trustAsResourceUrl(openUrl);
        $timeout(function() {
          finishLogin();
        },2000);
      });
    };

    var cleanUp = function() {
      $rootScope.bodylayout   = undefined;
      scope.state.hidden      = undefined;
      scope.state.status      = undefined;
      scope.password          = undefined;
      scope.username          = undefined;
      scope.logincode         = undefined;
      scope.error             = undefined;
    };

    var init = function() {
      CT.status().then(function(res) {
        chooseForm();
        scope.email_required  = (attrs.emailRequired === 'true');
        scope.newsletter      = (attrs.newsletter === 'true') || scope.email_required;
        scope.reqreg          = (attrs.reqreg === 'true');
        scope.btn_text        = (attrs.btntext || 'Submit');

        if (attrs.terms !== 'true') {
          scope.show_terms = true;
        }

        if (attrs.unified === 'true') {
          scope.show_unified = true;
        }

      }, function(err) {
        scope.state.status = undefined;
        scope.state.hidden = undefined;
        scope.state.errors = err;
        $rootScope.bodylayout = 'login-error';
      });
    };

    var chooseForm = function() {
      if (attrs.registration === 'true') {
        if (attrs.code) {
            try {
              scope.data = JSON.parse(attrs.code);
            } catch(e){
              scope.data = 'Nothing to be seen';
            }
        }
        addReg();
      } else {
        addForm();
      }
    };

    var addReg = function() {
      var template =
        '<div ng-hide=\'login == true\'>'+
        '<div ng-show=\'reqreg == true && show_reg_login\'>'+
        '<form name=\'myForm\'>'+
        '<label>Email Address</label>'+
        '<input ng-model=\'username\' name=\'username\' type=\'email\' placeholder=\'Enter your registered email\' required></input>'+
        '<p ng-show=\'myForm.username.$error.required\'><small>Email is invalid.</small></p>'+
        '<label>Password</label>'+
        '<input ng-model=\'password\' name=\'password\' type=\'password\' placeholder=\'Enter your password\' required></input>'+
        '<p ng-show=\'myForm.password.$error.required\'><small>Password is required.</small></p>'+
        '<p><button ng-disabled="myForm.$invalid" ng-click="submit()">Login</button></br>' +
        '<a href=\'\' ng-click=\'show_reg_login = !show_reg_login\'>Sign-up Now.</a></p>'+
        '</form>'+
        '</div>'+
        '<div ng-hide=\'show_reg_login\'>'+
        '<h3>{{ data.message }}</h3>'+
        '<form name="loginForm" novalidate>'+
        '<div ng-form="sF_{{$index}}" ng-repeat="field in data.fields | orderBy: \'order\'" class=\'reg-fields\'>' +
        '<label class="ct-label" ng-hide="field.field_type == \'checkbox\' || field.label == \'hidden\'">{{ field.label }}</label>'+
        '<span ng-hide="field.field_type == \'radio\'">'+
        '<input ng-show=\'field.field_type != "textarea"\' type="{{ field.field_type }}" ng-model="field.value" name="input_{{$index}}_0" ng-required="field.required" ng-class="{ \'has-error\' : loginForm.sF_{{$index}}.input_{{$index}}_0.$invalid }" placeholder=\'Enter your {{ field.name == "username" ? "email" : field.name }}\'></input>' +
        '<label ng-show="field.field_type == \'checkbox\'">{{ field.label }}</label>'+
        '<textarea rows=\'5\' ng-show=\'field.field_type == "textarea"\' rows=\'3\' type="{{ field.field_type }}" ng-model="field.value" name="input_{{$index}}_0" ng-required="field.required" ng-class="{ \'has-error\' : loginForm.sF_{{$index}}.input_{{$index}}_0.$invalid }" placeholder=\'Enter your {{ field.name }}\'></textarea>' +
        '<p class="required"><span ng-show="loginForm.sF_{{$index}}.input_{{$index}}_0.$error.required">{{ field.name | sentenceCase }} is required</span></p>'+
        '</span>'+
        '<span ng-show="field.field_type == \'radio\'">'+
        '<span id="radio_container_{{$index}}" ng-repeat="attr in field.attrs">'+
        '<input type="radio" ng-model="field.value" value="{{attr}}" id="radio_inner_{{ attr }}_{{ $index }}">'+
        '<label for="radio_inner_{{ attr }}_{{$index}}" class="ct-label" ><span></span>{{attr}}</label>'+
        '</span>'+
        '</div>'+
        '<div class=\'break\'></div>'+
        '<button ng-disabled="loginForm.$invalid" class="btn" ng-click="submit(data)">{{ btn_text }}</button>' +
        '<p ng-show="reqreg == true"><a href=\'\' ng-click=\'show_reg_login = !show_reg_login\'>Already registered? Login now.</a></p>'+
        '</form>' +
        '</div>' +
        '</div>';

      var templateObj = $compile(template)(scope);
      element.html(templateObj);
      cleanUp();
    };

    var addForm = function() {
      scope.code = attrs.code;
      var template =
        '<iframe style="display: none;" width="0" height="0" ng-src="{{detailFrame}}"></iframe>'+
        '<div ng-show=\'preview\' class=\'alert-box\'><small>{{ preview }}</small></div>'+
        '<div ng-hide=\'disabled || success\'>'+
        '<div ng-hide=\'login == true\'>' + scope.code + '</div>'+
        '</div>';

      var templateObj = $compile(template)(scope);
      element.html(templateObj);
      cleanUp();
    };

    var redirectUser = function() {
      if ( attrs.redirects !== undefined || attrs.redirects !== '') {
        var redirects = JSON.parse(attrs.redirects);
        if (redirects.show_welcome ) {
          $location.path('/welcome');
        } else {
          var redirectTo;
          if ( redirects.success_url !== '' && redirects.success_url !== null) {
            redirectTo = redirects.success_url;
          } else {
            redirectTo = 'http://bbc.co.uk';
          }
          $window.location.href = redirectTo;
        }
      }
    };

    attrs.$observe('code', function(val){
      if (val !== '' ) {
        init();
      }
    });

  };

  return {
    link: link,
    scope: {
      code: '@',
      redirects: '@',
      state: '=',
      emailRequired: '@',
      newsletter: '@',
      registration: '@',
      reqreg: '@',
      terms: '@',
      btntext: '@'
    },
  };

}]);

app.directive('welcome', ['$routeParams', '$rootScope', '$location', '$window', 'Login', '$timeout', 'Client', function($routeParams, $rootScope, $location, $window, Login, $timeout, Client) {

  var link = function(scope,element,attrs) {

    // scope.loading = true;

    function init() {
      Client.details().then(function(client) {
        Login.welcome({request_uri: client.requestUri, apMac: client.apMac, clientMac: client.clientMac}).$promise.then(function(results) {
          cleanUp();
          scope.welcome = results.welcome;
          if (results.timeout > 0) {
            var timeout = results.timeout * 1000;
            var redirectTo = results.success_url || 'https://google.com';
            $timeout(function() {
              $window.location.href = redirectTo;
            },timeout);
          }
        });
      });

    }

    var cleanUp = function() {

      $rootScope.bodylayout = undefined;
      scope.state.hidden = undefined;
      scope.state.status = undefined;
      scope.password = undefined;
      scope.username = undefined;
      scope.error = undefined;

    };

    scope.$watch('routeParams', function(newVal, oldVal) {
      init();
    });

  };

  return {
    link: link,
    replace: true,
    scope: false,
    template: '<div><p ng-bind-html="welcome"></p></div>'
  };

}]);

app.directive('forgotPassword', ['$timeout', '$location', '$compile', 'CT', function($timeout,$location,$compile,CT) {

  var link = function(scope,element,attrs) {

    scope.init = function() {
      scope.remind = undefined;
      scope.email  = undefined;
      var template = '<div><p><b><a href=\'\' ng-click=\'showForm()\'>Forgot your details?</a></b></p></div>';
      var templateObj = $compile(template)(scope);
      element.html(templateObj);
    };

    scope.sendReminder = function(email, splash_id) {
      scope.reminding = true;
      CT.remind(email, splash_id).then(function(res) {
        scope.reminded = true;
        $timeout(function() {
          scope.reminding = undefined;
          scope.reminded  = undefined;
          scope.init();
        },2000);
      }, function() {
        scope.errors = true;
        scope.remind = undefined;
      });
    };

    scope.showForm = function() {
      scope.remind = true;
      scope.splash_id = attrs.splashId;
      var template =
        '<div class=\'row\'>'+
        '<div class=\'small-12 medium-8 columns medium-centered\'>'+
        '<div ng-show=\'reminded\'>'+
        '<div class=\'alert-box success\'>'+
        'Reminder email send. It shouldn\'t take long.'+
        '</div>'+
        '</div>'+
        '<div ng-show=\'errors\'>'+
        '<div class=\'alert-box alert\'>'+
        'There was an error, try again later.'+
        '</div>'+
        '</div>'+
        '<form name=\'myForm\' ng-submit=\'sendReminder(email,splash_id)\'>'+
        '<label>Enter the email you signed-up with</label>'+
        '<input type=\'email\' ng-model=\'email\' placeholder=\'Enter the email you signed-up with\' autofocus required></input>'+
        '<br>'+
        '<button ng-disabled=\'myForm.$invalid || myForm.$pristine\' class=\'button btn small default\'>Remind me <span ng-if=\'reminding\'><i class="fa fa-cog fa-spin"></i></span></button>'+
        '<p><a href=\'\' ng-click=\'init()\'>Cancel</a></p>'+
        '</form>'+
        '</div>'+
        '</div>';
      var templateObj = $compile(template)(scope);
      element.html(templateObj);
    };

    attrs.$observe('active', function(val){
      if (val !== '' && val === 'true') {
        scope.init();
      }
    });
  };

  return {
    link: link,
    scope: {
      active: '@',
      splash_id: '@',
      remind: '='
    }
  };

}]);

app.directive('loginsPartial', ['$location', function($location) {
  var link = function(scope, element, attrs) {
    scope.partial = function() {
      if ($location.path() === '/shop') {
        return 'components/logins/_shop.html';
      } else {
        return 'components/logins/_form.html';
      }
    };
  };

  return {
    link: link,
    scope: true,
    template: '<div ng-include="partial()" ng-hide=\'initialising\'></div>'
  };

}]);

app.directive('displayStore', ['CT', '$cookies', '$rootScope', '$location', '$window', 'Order', 'Client', '$localStorage', '$q', function(CT, $cookies, $rootScope, $location, $window, Order, Client, $localStorage, $q) {

  var link = function(scope, element, attrs) {

    scope.customer = {};

    attrs.$observe('id', function(val){
      if (val !== '' ) {
        loadShop();
        cleanUp();
        // scope.state.status = undefined;
      }
    });

    function loadShop() {
      scope.cartId = $cookies.get('cartId');
      if (scope.cartId === undefined) {
        scope.showcart = true;
      } else {
        scope.getCart();
      }
    }

    scope.getCart = function() {
      CT.getCart($cookies.get('cartId')).then(function(res) {
        scope.cart = res;
        scope.showcart = true;

        if (scope.cart.store.merchant_type === 'stripe') {
          loadStripe();
        }
        sliceProducts(scope.cart.products[0]._id);
      }, function() {
        scope.showcart = true;
      });
    };

    function sliceProducts(id) {
      for (var i = 0; i < scope.products.length; ++i) {
        if (scope.products[i]._id === id) {
          scope.products.splice(i, 1);
        }
      }
    }

    scope.addToCart = function(id) {
      scope.adding = id;
      CT.addToCart({store_id: attrs.id, product_ids: id}).then(function(res) {
        if (res && res.cart) {
          scope.cartId = true;
          addProductToCart(res);
          scope.cart = res;
          if (scope.cart.store.merchant_type === 'stripe' && !scope.stripe_loaded) {
            loadStripe();
          }
        } else {
          scope.cartId = undefined;
          wipeCart();
        }
      }, function(err) {
        $rootScope.banneralert = 'banner-alert alert-box alert';
        $rootScope.error = 'Something\'s gone wrong.';
        scope.cart = { errors: err };
        scope.adding = undefined;
      });
    };

    function addProductToCart(res) {
      $rootScope.banneralert = 'banner-alert alert-box success';
      $rootScope.error = 'Voucher added to cart.';
      if (scope.cart !== undefined && scope.cart.products !== null) {
        scope.products.push(scope.cart.products[0]);
      }
      scope.cart = { products: res.products, cart: { cart_id: res.cart.cart_id } };
      scope.showstore = undefined;
      scope.showcart = true;
      sliceProducts(scope.cart.products[0]._id);
    }

    function wipeCart() {
      $rootScope.banneralert = 'banner-alert alert-box success';
      $rootScope.error = 'That\'s gone well. We\'ve emptied your cart.';
      scope.cart = undefined;
      scope.showcart = true;
    }

    scope.emptyCart = function() {
      scope.products.push(scope.cart.products[0]);
      scope.addToCart();
    };

    scope.paypal = function() {
      Client.details().then(function(client) {
        $localStorage.searchParams = JSON.stringify(client);
        scope.redirecting = true;
        var return_url = $location.protocol() + '://' + $location.host() + '/confirm';
        Order.create({clientMac: client.clientMac, return_url: return_url, cart_id: scope.cart.cart.cart_id }).$promise.then(function(results) {
          $window.location.href = results.response;
        });
      });
    };

    var loadStripe = function() {
      if (scope.stripe_loaded === undefined) {
        var src = 'https://checkout.stripe.com/checkout.js';
        $.getScript( src, function( data, textStatus, jqxhr ) {
          scope.stripe_loaded = true;
          configureStripe();
        });
      }
    };

    var handler;
    var configureStripe = function() {
      handler = StripeCheckout.configure({
        key: scope.cart.store.token_stripe,
        // image: '/img/documentation/checkout/marketplace.png',
        locale: 'auto',
        token: function(token) {
          scope.stripe = true;
          scope.stripeProcess(token);
        },
        closed: function() {
          scope.cart.state = undefined;
          scope.showcart = true;
          scope.$digest();
        }
      });
      scope.$digest();
    };

    scope.stripeProcess = function(token) {
      createOrder(token);
    };

    var createOrder = function(token) {
      Client.details().then(function(client) {
        Order.create({clientMac: client.clientMac, cart_id: scope.cart.cart.cart_id, email: token.email, card: token.id }).$promise.then(function(results) {
          scope.showcart = undefined;
          scope.stripe = undefined;
          scope.vouchers = results.response;
          scope.cart.state = 'complete';
          $cookies.remove('cartId');
        }, function(err) {
          console.log('Order creation error:', err);
          scope.stripe = undefined;
          $rootScope.banneralert = 'banner-alert alert-box alert';
          $rootScope.error = 'There was a problem processing your order.';
          scope.cart.state = undefined;
          $cookies.remove('cartId');
        });
      });
    };

    scope.stripePayment = function() {
      $rootScope.banneralert = undefined;
      if (handler) {
        handler.open({
          name: 'WiFi Access',
          description: scope.cart.products.length + ' Internet voucher',
          currency: scope.cart.store.currency || 'gbp',
          amount: scope.cart.cart.total
        });
      }
      scope.cart.state = 'processing';
      scope.showcart = undefined;
    };

    scope.saveSage = function() {
      scope.redirecting = true;
      Client.details().then(function(client) {
        var return_url = $location.protocol() + '://' + $location.host() + '/confirm';
        $cookies.put('email', scope.customer.email);
        Order.create({clientMac: client.clientMac, return_url: return_url, cart_id: scope.cart.cart.cart_id, customer: scope.customer}).$promise.then(function(results) {
          $localStorage.searchParams = JSON.stringify(client);
          window.location.href = results.response;
        }, function(err) {
          console.log(err);
          // $rootScope.banneralert = 'banner-alert alert-box alert';
          // $rootScope.error = 'Your card was declined, please try again';
          // scope.cart.state = 'declined';
          // scope.cart.error = err.message;
          // scope.showcart   = true;
        });
      });
    };

    scope.loginNow = function() {
      scope.loggingIn = true;
      guestLogin().then(function(a) {
        $window.location.href = 'http://google.com';
      }, function(err) {
        $rootScope.banneralert = 'banner-alert alert-box alert';
        $rootScope.error = err;
      });
    };

    function guestLogin() {
      var deferred = $q.defer();
      var username, password;
      if (scope.vouchers !== undefined && scope.vouchers.length > 0) {
        username = scope.vouchers[0].username;
        password = scope.vouchers[0].password;
      }
      CT.login({username: username, password: password}).then(function(res) {
        deferred.resolve();
      }, function(err) {
        console.log(err);
        deferred.reject('We were unable to log you in, go back to the home page and try again.');
      });
      return deferred.promise;
    }


    var cleanUp = function() {
      $rootScope.bodylayout = undefined;
      scope.state.hidden = undefined;
      scope.state.status = undefined;
      scope.error = undefined;
    };

  };

  return {
    link: link,
    scope: false,
    templateUrl: 'components/logins/_display_store.html'
  };

}]);

app.directive('buildPage', ['$location', '$compile', '$window', '$rootScope', '$timeout', function($location, $compile, $window, $rootScope, $timeout) {

  var link = function(scope, element, attrs) {

    var buildPage = function(data) {

      var head = angular.element('head');
      var template;

      template =

        'html {' +
        '\tbackground: url({{ splash.background_image_name }}) no-repeat center center fixed;\n' +
        '\t-webkit-background-size: cover;\n' +
        '\t-moz-background-size: cover;\n' +
        '\t-o-background-size: cover;\n'+
        '\tbackground-size: cover;\n'+
        '\tbackground-color: {{splash.background_image_name ? \'transparent\' : splash.body_background_colour}}!important;\n'+
        '}\n\n'+

        'body {\n'+
        '\tmargin-top: 0px;\n'+
        '\tfont-family: {{ splash.font_family }}!important;\n' +
        '}\n\n'+

        'h1 {\n'+
        '\tfont-size: {{ splash.heading_text_size}};\n'+
        '\tcolor: {{ splash.heading_text_colour}};\n'+
        '}\n\n'+

        'h2 {\n'+
        '\tfont-size: {{ splash.heading_2_text_size}};\n'+
        '\tcolor: {{ splash.heading_2_text_colour}};\n'+
        '\tline-height: 1.3em;\n'+
        '\tmargin-bottom: 20px;\n'+
        '}\n\n'+

        'h3 {\n'+
        '\tfont-size: {{ splash.heading_3_text_size}};\n'+
        '\tcolor: {{ splash.heading_3_text_colour}};\n'+
        '\tline-height: 1.3em;\n'+
        '}\n\n'+

        'p {\n'+
        '\tfont-size: {{ splash.body_font_size }}!important;\n'+
        '\tcolor: {{ splash.body_text_colour }};\n'+
        '}\n\n'+

        'label {\n'+
        '\tfont-size: {{ splash.body_font_size }}!important;\n'+
        '\tcolor: {{ splash.body_text_colour }};\n'+
        // '\tmargin-bottom: 10px!important;\n'+
        '}\n\n'+

        'a {\n'+
        '\tcolor: {{splash.link_colour}};\n'+
        '}\n\n'+

        '.btn, button {\n'+
        '\tdisplay: inline-block;\n'+
        '\ttext-align: center;\n'+
        '\tvertical-align: middle;\n'+
        '\tcursor: pointer;\n'+
        '\tbackground-image: none;\n'+
        '\tborder: 1px solid transparent;\n'+
        '\twhite-space: nowrap;\n'+
        '\tline-height: 1.428571429;\n'+
        '\tborder-radius: 0px;\n'+
        '\t-webkit-user-select: none;\n'+
        '\t-moz-user-select: none;\n'+
        '\t-ms-user-select: none;\n'+
        '\t-o-user-select: none;\n'+
        '\tuser-select: none;\n'+
        '\tfont-size: {{ splash.btn_font_size }}!important;\n'+
        '\tcolor: {{splash.btn_font_colour}}!important;\n'+
        '\tmargin: 10px 0 15px 0;\n'+
        '\tpadding: {{ splash.button_padding }}!important;\n'+
        '\tline-height: {{ splash.button_height || "50px" }}!important;\n'+
        '\theight: {{ splash.button_height || "50px" }}!important;\n'+
        '\tborder-radius: {{ splash.button_radius }};\n'+
        '\tbackground-color: {{splash.button_colour}};\n'+
        '\tborder-color: {{ splash.button_border_colour }};\n'+
        '}\n\n'+

        'button.disabled, button[disabled], .button.disabled, .button[disabled] {\n'+
        '\tbackground-color: {{splash.button_colour}};\n'+
        '\tborder-color: {{ splash.button_border_colour }};\n'+
        '\topacity: 0.8;\n'+
        '}\n\n'+

        'button.disabled:hover, button.disabled:focus, button[disabled]:hover, button[disabled]:focus, .button.disabled:hover, .button.disabled:focus, .button[disabled]:hover, .button[disabled]:focus, button:hover, button:focus, .button:hover, .button:focus {\n'+
        '\tbackground-color: {{splash.button_colour}}!important;\n'+
        '\tborder: 1px solid {{ splash.button_border_colour || \'#000\'}};\n'+
        '\topacity: 0.9;\n'+
        '}\n\n'+

        'small, .small {\n'+
        '\tfont-size: 11px;\n'+
        '}\n\n'+

        '.container {\n'+
        '\tfloat: {{ splash.container_float }}!important;\n'+
        '}\n\n'+

        '.splash-container {\n'+
        '\ttext-align: {{ splash.container_text_align }}!important;\n'+
        '\tpadding: 0px 0 0 0;\n'+
        '\tmargin: 0 auto;\n'+
        '\tmax-width: {{ splash.container_width }};\n'+
        '\twidth: 98%;\n'+
        '}\n\n'+

        '.inner_container {\n'+
        '\tborder-radius: {{ splash.container_inner_radius }};\n'+
        '\ttext-align: {{ splash.container_text_align }};\n'+
        '\tborder: 1px solid {{ splash.border_colour || \'#CCC\' }};\n'+
        '\tbackground-color: {{ splash.container_colour }}!important;\n'+
        '\topacity: {{ splash.container_transparency }};\n'+
        // '\tpadding: 20px 10px;\n'+
        '\twidth: {{splash.container_inner_width}};\n'+
        '\tmin-height: 100px;\n'+
        '\tdisplay: block;\n'+
        '\tpadding: {{ splash.container_inner_padding }};\n'+
        '}\n\n'+

        '.footer {\n'+
        '\tdisplay: block;\n'+
        '\tpadding: 10px 0;\n'+
        '\tfont-size: 10px;\n'+
        '\tline-height: 18px;\n'+
        '\twidth: {{splash.container_inner_width}};\n'+
        '\tcolor: {{splash.footer_text_colour}};\n'+
        '}\n\n'+

        '.footer a {\n'+
        '\tcolor: {{splash.footer_text_colour}}!important;\n'+
        '}\n\n'+

        '.location_logo {\n'+
        '\ttext-align: {{ splash.logo_position }};\n'+
        '\tmargin: 0 0px 20px 0px;\n'+
        '}\n\n'+

        '.location_logo img {\n'+
        '\tmax-width: 220px;\n'+
        '}\n\n'+

        '.social {\n'+
        '\tmargin: 10px;\n'+
        '}\n\n'+

        '.social img {\n'+
        '\twidth: 32px;\n'+
        '\theight: 32px;\n'+
        '}\n\n'+

        '#container-c1 {\n'+
        '\tpadding: 0px 0px 0 0px;\n'+
        '}\n\n' +

        '.skinny-c1 {\n'+
        '\twidth: {{splash.container_inner_width}};\n'+
        '\tmargin: 0 auto;\n'+
        '}\n\n' +

        '#container-c2 {\n'+
        '\tdisplay: {{ splash.design_id === 2 ? \'block\' : \'none\' }};\n'+
        'float: left;\n' +
        '\tpadding-top: 15px;\n'+
        '}\n\n' +

        '.btn {\n' +
        '\tmargin-top: 10px!important;\n'+
        '}\n\n'+

        '.columns {\n' +
        // '\tpadding-left: 5px!important;\n'+
        // '\tpadding-right: 5px!important;\n'+
        '}\n\n'+

        'p.required {\n'+
        '\tmargin-top: -10px;\n'+
        '\tfont-size: {{ splash.input_required_size }}!important;\n'+
        '\tcolor: {{ splash.input_required_colour }};\n'+
        '}\n\n'+

        'input, textarea {\n'+
        '\tmax-width: {{ splash.input_max_width }}!important;\n' +
        '\tpadding: {{ splash.input_padding}}!important;\n' +
        '\tborder: {{ splash.input_border_width}} solid {{ splash.input_border_colour}}!important;\n' +
        '\tborder-radius: {{ splash.input_border_radius }}!important;\n' +
        '\tbox-shadow: inset 0 0px 0px rgb(255, 255, 255)!important;\n' +
        '\tbackground-color: {{ splash.input_background }}!important;\n'+
        '\tborder-width: {{ splash.input_border_width }}!important;\n'+
        '\tborder-color: {{ splash.input_border_colour }}!important;\n'+
        '\tmargin: 0 0 0.5rem -5px!important;\n'+
        '\tcolor: {{ splash.input_text_colour }}!important;\n'+
        '}\n\n' +

        'input[type=text], textarea {\n'+
        '\theight: {{ splash.input_height || \'40px\' }}!important;\n'+
        '\tline-height: {{ splash.input_height || \'40px\' }}!important;\n'+
        '}\n\n' +

        'textarea {\n'+
        '\tpadding: 10px!important;\n' +
        '\theight: auto!important;\n'+
        '\tresize: vertical!important;\n'+
        '\tline-height: 1em!important;\n'+
        '}\n\n' +

        'input[type="checkbox"], input[type=radio] {\n'+
        // '\tmargin: {{ splash.container_inner_padding }};\n'+
        // '\theight: 12px!important;\n'+
        // '\tline-height: 12px!important;\n'+
        '}\n\n'+

        '{{ splash.custom_css }}';

      head.append($compile('<style>' + template + '</style>')(scope));
      head.append($compile('<link ng-href=\'{{splash.external_css}}\' rel=\'stylesheet\' />')(scope));
      // $window.document.title = scope.splash;

      addCopy(data);
    };

    var addCopy = function(data) {
      $timeout(function() {
        clearUp();
      },100);
    };

    var clearUp = function() {
    };

    buildPage();

  };

  return {
    link: link
  };

}]);

app.directive('googleAnalytics', ['$compile', function($compile) {

  var link = function(scope,element,attrs) {
    var init = function(id) {
      var template =
        '<script>'+
        '(function(i,s,o,g,r,a,m){i["GoogleAnalyticsObject"]=r;i[r]=i[r]||function(){'+
        '  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),'+
        '    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)'+
        '})(window,document,"script","//www.google-analytics.com/analytics.js","ga");'+
        'ga("create", "' + id + '", "auto");'+
        'ga("send", "pageview");'+
        '</script>';

      var templateObj = $compile(template)(scope);
      element.html(templateObj);
    };

    attrs.$observe('id', function(val){
      if (val !== '') {
        init(attrs.id);
      }
    });
  };

  return {
    link: link,
    scope: {
      id: '@'
    }
  };
}]);




