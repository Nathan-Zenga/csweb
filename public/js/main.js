$(function() {
    window.submitBtnController = function(form, progressMsg) {
        var $submitBtn = this.submitBtn = $(form).find("[type=submit]").attr("disabled", true);
        var method = this.method = this.submitBtn.is(":button") ? "html" : "val";
        this.originalVal = this.submitBtn[method]();
        var progressVal = this.submitBtn[method](progressMsg || "SUBMITTING")[method]();
        this.interval = setInterval(function() {
            var val = $submitBtn[method](), ellipsis = $submitBtn[method]().includes("...");
            $submitBtn[method](ellipsis ? progressVal : val + ".");
        }, 500);
    };
    submitBtnController.prototype.finish = function() {
        clearInterval(this.interval);
        this.submitBtn[this.method](this.originalVal).attr("disabled", false);
    };

    var state, homepage = location.pathname === "/";
    $(window).on("load scroll", function() {
        if (state != window.pageYOffset > $("main").offset().top+20 && !homepage) {
            state = window.pageYOffset > $("main").offset().top+20;
            $("#cs-logo").fadeOut(200, function() {
                $(this).toggleClass("fixed", state).parent("a").attr("href", "/").removeAttr(state ? "href" : "").end().fadeIn(200);
            });
        }
    });

    $("#nav-toggle").click(function() {
        $(this).toggleClass("nav-open");
        var navOpen = $(this).hasClass("nav-open");
        $("nav").stop().slideToggle(function() { if(!navOpen) $(this).css("display", "") });
    });
});
