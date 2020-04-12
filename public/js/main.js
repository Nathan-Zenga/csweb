$(function() {
    var state = window.pageYOffset > $("main").offset().top+20;
    $(window).on("load scroll", function() {
        if (state != window.pageYOffset > $("main").offset().top+20) {
            state = window.pageYOffset > $("main").offset().top+20;
            $("#cs-logo").fadeOut(200, function() {
                $(this).toggleClass("fixed", state).parent("a").attr("href", "/").removeAttr(state ? "href" : "").end().fadeIn(200);
            });
        }
    });

    $("#nav-button").click(function() {
        $(this).toggleClass("nav-open");
        var navOpen = $(this).hasClass("nav-open");
        $("nav").stop().slideToggle(function() { if(!navOpen) $(this).css("display", "") });
    });
});
