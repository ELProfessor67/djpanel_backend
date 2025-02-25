function isToday(year,month,date){
    const Currntdate = new Date();
    if(+year == Currntdate.getFullYear() && +month == Currntdate.getMonth()+1 && +date == Currntdate.getDate()){
        return true;
    }else{
        return false;
    }
}

function checkInTimeRange(startTime, endTime, user) {
	let now = new Date();
	let currentHour = now.getUTCHours();
	let currentMinute = now.getUTCMinutes();
	let currentSecond = now.getUTCSeconds();

	const [startHour, startMinute] = startTime.split(":").map(Number);
	const [endHour, endMinute] = endTime.split(":").map(Number);

	const currentTimeInSeconds = currentHour * 3600 + currentMinute * 60 + currentSecond;
	const startTimeInSeconds = startHour * 3600 + startMinute * 60;
	const endTimeInSeconds = endHour * 3600 + endMinute * 60;

	// Check if the current day is in the allowed DJ days
	const checkDay = user?.djDays?.includes(now.getDay().toString());

	if (!checkDay) {
		return { inRange: false, secondsToStart: null };
	}

	if (currentTimeInSeconds >= startTimeInSeconds && currentTimeInSeconds <= endTimeInSeconds) {
		return { inRange: true, secondsToStart: 0 };
	} else if (currentTimeInSeconds < startTimeInSeconds) {
		let secondsToStart = startTimeInSeconds - currentTimeInSeconds;
		return { inRange: false, secondsToStart };
	} else {
		return { inRange: false, secondsToStart: null }; // If time has passed
	}
}

function checkIsStreamingDay(user){
    const [userYear,userMonth,userDate] = user?.djDate?.split('-');

    if(isToday(userYear,userMonth,userDate)){
        return true
    }
    const checkDay = user?.djDays?.includes((new Date().getDay()).toString())
    if(checkDay){
        return true
    }
    return false;
}

module.exports = {checkInTimeRange,checkIsStreamingDay }