$(function() {
	var height = $("#cs-logo").css("height");

	$(window).on("load scroll", function() {
		var state = window.pageYOffset > $("main").offset().top+20;
		$("#cs-logo").toggleClass("fixed", state).parent("a").attr("href", "/").removeAttr(state ? "href" : "");
	});

	$("#nav-button").click(function() {
		$(this).toggleClass("nav-open");
		var navOpen = $(this).hasClass("nav-open");
		$("nav").stop().slideToggle(function() { if(!navOpen) $(this).css("display", "") });
	});
});
