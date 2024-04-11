/*
 * Apple Aerial screensaver.
 *
 * Usage:
 *   mount --bind ./screensaver-main.qml /usr/palm/applications/com.webos.app.screensaver/qml/main.qml
 *
 * Test launch (no way to trigger on "No signal" screen)
 *   luna-send -n 1 'luna://com.webos.service.tvpower/power/turnOnScreenSaver' '{}'
 */
import QtQuick 2.4
import QtMultimedia 5.6
import Eos.Window 0.1
import Eos.Items 0.1
import WebOS.Global 1.0
import QtQuick.Window 2.2

WebOSWindow {
	
	id: window
	width: 1920
	height: 1080
	windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"
	color: "black"
	appId: "com.webos.app.screensaver"
	visible: true

	property int currentPOI: 0
	property int currentIndex: Math.floor(Math.random() * videoList.length)
	property var currentMedia: videoList[currentIndex].src.H2651080p

    Component.onCompleted: {
		videoOutput.play()
    }	

	Video {
		id: videoOutput
		fillMode: VideoOutput.PreserveAspectCrop
		width: parent.width
		height: parent.height - 1 //non fullscreen to avoid screensaver automatic disabling 
		source: currentMedia
		visible: true
		autoLoad: true
		onStopped: {
			punchThroughArea.visible = false
			playNextVideo()
			osd.visible = false
			fadeOutVideo.running = false
		}
		onPaused: {
			punchThroughArea.visible = false
			playNextVideo()
			osd.visible = false
			fadeOutVideo.running = false
		}			
		onPlaying: {
			punchThroughArea.visible = true
			fadeInVideo.running = true
			fadeInOsd.running = true
			osd.visible = true
		}
		PunchThrough {
			id: punchThroughArea
			visible: false
			x: 0; y: 0; z: -1
			width: parent.width
			height: parent.height
			
			Rectangle {
				id: opacityBox
				width: 1920
				height: 1080
				z:1
				color: "black"
				
				OpacityAnimator {
					id: fadeInVideo
					target: opacityBox 
					from: 1
					to: 0
					duration: 3000
					running: false
				}
				
				OpacityAnimator {
					id: fadeOutVideo
					target: opacityBox
					from: 0
					to: 1
					duration: 5000
					running: false
				}
			}
			
		}		
	}		
	
	Rectangle {
		id: osd
		opacity: 0
		visible: false
		color: "transparent"
		anchors.fill: parent
		anchors.margins: 75
		FontLoader { 
			id: segoeUILight
			source: "file:///media/developer/apps/usr/palm/applications/org.webosbrew.custom-screensaver-aerial/assets/SegoeUI-Light.ttf" 
		}
		OpacityAnimator {
			id: fadeInOsd
			target: osd 
			from: 0
			to: 1
			duration: 3000
			running: false
		}	
		
		OpacityAnimator {
			id: fadeOutOsd
			target: osd 
			from: 1
			to: 0
			duration: 5000
			running: false
		}
		
		Text {
			id: name
			opacity:0.65
			text: videoList[currentIndex].name
			font.family: segoeUILight.name
			font.letterSpacing: -1
			fontSizeMode: Text.Fit
			font.pixelSize: 58
			y: parent.height * 0.9
			color: "white"
			style: Text.Raised
			styleColor: "black"
		}

		Text {
			id: poi
			opacity:name.opacity
			text: videoList[currentIndex].pointsOfInterest[currentPOI]
			font.family: name.font.family
			font.letterSpacing: name.font.letterSpacing
			fontSizeMode: name.fontSizeMode
			font.pixelSize: name.font.pixelSize - 16
			y: name.y + name.font.pixelSize + 10
			color: name.color
			style: name.style
			styleColor: name.styleColor
		}

		Text {
			id: time 
			horizontalAlignment:  Text.AlignRight
			anchors.right: parent.right
			opacity:name.opacity
			font.family: name.font.family
			font.letterSpacing: name.font.letterSpacing
			font.pixelSize: name.font.pixelSize + 23
			y: date.y - name.font.pixelSize - 40
			color: name.color
			style: name.style
			styleColor: name.styleColor
			fontSizeMode: name.fontSizeMode
			text: "" 
		}

		Text {
			id: date
			horizontalAlignment:  Text.AlignRight
			anchors.right: parent.right
			opacity:name.opacity
			font.family: name.font.family
			font.letterSpacing: name.font.letterSpacing
			font.pixelSize: name.font.pixelSize - 16
			y: name.y + name.font.pixelSize + 5
			color: name.color
			style: name.style
			styleColor: name.styleColor
			fontSizeMode: name.fontSizeMode
			text: ""           
		}

		Text {
			id: debug
			horizontalAlignment:  Text.AlignRight
			anchors.right: parent.right
			opacity:0.9
			font.family: name.font.family
			font.pixelSize: name.font.pixelSize - 30
			color: name.color
			style: name.style
			styleColor: name.styleColor
			fontSizeMode: name.fontSizeMode
			text: "" 
		}		
	}

	Timer {
       	interval: 250 
       	running: true
       	repeat: true
       	onTriggered: {
		updateTime()
        if (videoList[currentIndex].pointsOfInterest[Math.floor(videoOutput.position/1000)]) currentPOI = Math.floor(videoOutput.position/1000)
		if (Math.floor(videoOutput.position/1000) == Math.floor(videoOutput.duration/1000) - 5) {
			fadeOutVideo.running = true
			fadeOutOsd.running = true
		}
		if (videoOutput.status == MediaPlayer.EndOfMedia) playNextVideo()
		if (videoOutput.error !== 0) { 
			punchThroughArea.visible = false;
			playNextVideo();
		}
		}
	}
		
	function playNextVideo() {
		currentIndex = Math.floor(Math.random() * videoList.length)
		videoOutput.source = currentMedia
		videoOutput.play()
	}

	function updateTime() {
        var now = new Date();
		if (now.getHours() < 10) var hours = "0" + now.getHours();
			else var hours = now.getHours();
		if (now.getMinutes() < 10) var minutes = "0" + now.getMinutes();
			else var minutes = now.getMinutes();
        time.text = hours + ":" + minutes;
		const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      	const monthNames = ["January", "February", "March", "April", "May", "June", "July","August", "September", "October", "November", "December"]; 
		if (now.getDate() == 1 || now.getDate() == 21 || now.getDate() == 31) var suffix = "st";
			else if (now.getDate() == 2 || now.getDate() == 22) var suffix = "nd";
				else if (now.getDate() == 3 || now.getDate() == 23) var suffix = "rd";
					else var suffix = "th";
      	date.text = daysOfWeek[now.getDay()] + " | " + now.getDate() + suffix + " " + monthNames[now.getMonth()] + " " + now.getFullYear();
		debug.text = 	videoOutput.source + 
				"\n Timecode: " + Math.floor(videoOutput.position/1000) + " / " + Math.floor(videoOutput.duration/1000) + 
				"\n Status: " + videoOutput.status +
				"\n Error: " + videoOutput.error + " " + videoOutput.errorString +
				"\n Playback State: " + videoOutput.playbackState +
				"\n Buffer Progress : " + videoOutput.bufferProgress
	}
	
	property var videoList: [
		  {
			"id": "2F72BC1E-3D76-456C-81EB-842EBA488C27",
			"accessibilityLabel": "Africa and the Middle East",
			"name": "Africa and the Middle East",
			"pointsOfInterest": {
			  "0": "Over the Horn of Africa traveling toward the Gulf of Adeno",
			  "45": "The southeastern Arabian Peninsula",
			  "115": "The Gulf of Oman approaching the Makran Coast",
			  "145": "The Makran Coast of Iran and Pakistan",
			  "160": "Over Iran moving toward Afghanistan and Pakistan",
			  "180": "Over Afghanistan and Pakistan moving toward the Karakoram Range",
			  "235": "Over the Karakoram Range traveling into China",
			  "280": "The Takla Makan Desert in western China",
			  "315": "The Tian Shan mountains in Central Asia"
			},
			"type": "space",
			"timeOfDay": "day",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A103_C002_0205DG_v12_SDR_FINAL_20180706_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A103_C002_0205DG_v12_SDR_FINAL_20180706_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A103_C002_0205DG_v12_SDR_FINAL_20180706_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "A837FA8C-C643-4705-AE92-074EFDD067F7",
			"accessibilityLabel": "Africa Night",
			"name": "Africa Night",
			"pointsOfInterest": {
			  "0": "Traveling northeast over the Sahara at night",
			  "70": "Over the Grand Erg Oriental heading toward the Mediterranean Sea",
			  "100": "The Mediterranean coast of Tunisia and Libya",
			  "120": "Moving over the Mediterranean Sea toward Italy",
			  "140": "Over southern Italy approaching the Balkan Peninsula with Turkey in the distance",
			  "165": "Over the Balkan Peninsula moving toward the Black Sea",
			  "180": "Over the Balkan Peninsula approaching the Black Sea",
			  "210": "Traveling over the Black Sea toward Ukraine",
			  "230": "Traveling over Ukraine toward Russia"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT312_162NC_139M_1041_AFRICA_NIGHT_v14_SDR_FINAL_20180706_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT312_162NC_139M_1041_AFRICA_NIGHT_v14_SDR_FINAL_20180706_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT312_162NC_139M_1041_AFRICA_NIGHT_v14_SDR_FINAL_20180706_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "C7AD3D0A-7EDF-412C-A237-B3C9D27381A1",
			"accessibilityLabel": "Alaskan Jellies",
			"name": "Alaskan Jellies 1",
			"pointsOfInterest": { "0": "Drifting over Moon Jellyfish near the coast of Alaska United States" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/g201_AK_A003_C014_SDR_20191113_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/g201_AK_A003_C014_SDR_20191113_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/g201_AK_A003_C014_SDR_20191113_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "C6DC4E54-1130-44F8-AF6F-A551D8E8A181",
			"accessibilityLabel": "Alaskan Jellies",
			"name": "Alaskan Jellies 2",
			"pointsOfInterest": { "0": "Drifting under Moon Jellyfish near the coast of Alaska United States" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/AK_A004_C012_SDR_20191217_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/AK_A004_C012_SDR_20191217_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/AK_A004_C012_SDR_20191217_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "03EC0F5E-CCA8-4E0A-9FEC-5BD1CE151182",
			"accessibilityLabel": "Antarctica",
			"name": "Antartica",
			"pointsOfInterest": { "0": "Aurora Australis over Antarctica" },
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT110_112NC_364D_1054_AURORA_ANTARTICA__COMP_FINAL_v34_PS_SDR_20181107_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT110_112NC_364D_1054_AURORA_ANTARTICA__COMP_FINAL_v34_PS_SDR_20181107_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT110_112NC_364D_1054_AURORA_ANTARTICA__COMP_FINAL_v34_PS_SDR_20181107_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "64D11DAB-3B57-4F14-AD2F-E59A9282FA44",
			"accessibilityLabel": "Atlantic Ocean to Spain and France",
			"name": "Atlantic Ocean to Spain and France",
			"pointsOfInterest": {
			  "0": "Over the North Atlantic Ocean heading toward Portugal",
			  "115": "Over Portugal and Spain",
			  "150": "Moving away from the Iberian Peninsula and passing over the Bay of Biscay and France",
			  "180": "Over Western Europe with the North Atlantic Ocean in the distance"
			},
			"type": "space",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A001_C001_120530_v04_SDR_FINAL_20180706_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A001_C001_120530_v04_SDR_FINAL_20180706_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A001_C001_120530_v04_SDR_FINAL_20180706_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "81337355-E156-4242-AAF4-711768D30A54",
			"accessibilityLabel": "Australia",
			"name": "Australia",
			"pointsOfInterest": {
			  "0": "Over the Indian Ocean heading toward Perth Australia",
			  "50": "Traveling northeast across Western Australia",
			  "170": "Over Western Australia approaching Northern Territory",
			  "220": "Over Northern Territory Australia moving toward New Guinea",
			  "335": "Over the Arafura Sea traveling toward New Guineao"
			},
			"type": "space",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT060_117NC_363D_1034_AUSTRALIA_v35_SDR_PS_FINAL_20180731_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT060_117NC_363D_1034_AUSTRALIA_v35_SDR_PS_FINAL_20180731_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT060_117NC_363D_1034_AUSTRALIA_v35_SDR_PS_FINAL_20180731_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "2B30E324-E4FF-4CC1-BA45-A958C2D2B2EC",
			"accessibilityLabel": "Barracuda",
			"name": "Barracuda",
			"pointsOfInterest": { "0": "A school of Chevron Barracuda in the waters near Borne" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/BO_A018_C029_SDR_20190812_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A018_C029_SDR_20190812_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A018_C029_SDR_20190812_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "687D03A2-18A5-4181-8E85-38F3A13409B9",
			"accessibilityLabel": "Bumpheads",
			"name": "Bumpheads",
			"pointsOfInterest": { "0": "Bumphead Parrotfish over the coral reefs off Borneoo" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/BO_A014_C008_SDR_20190719_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A014_C008_SDR_20190719_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A014_C008_SDR_20190719_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "27A37B0F-738D-4644-A7A4-E33E7A6C1175",
			"accessibilityLabel": "California Dolphins",
			"name": "California Dolphins",
			"pointsOfInterest": { "0": "Short-beaked Common Dolphins off the California coast, United States" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/DL_B002_C011_SDR_20191122_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/DL_B002_C011_SDR_20191122_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/DL_B002_C011_SDR_20191122_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "EB3F48E7-D30F-4079-858F-1A61331D5026",
			"accessibilityLabel": "California Kelp Forest",
			"name": "California Kelp Forest",
			"pointsOfInterest": { "0": "Moving through a kelp forest off of the California coast, United States" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/g201_CA_A016_C002_SDR_20191114_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/g201_CA_A016_C002_SDR_20191114_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/g201_CA_A016_C002_SDR_20191114_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "12318CCB-3F78-43B7-A854-EFDCCE5312CD",
			"accessibilityLabel": "California to Vegas",
			"name": "California to Vegas",
			"pointsOfInterest": {
			  "0": "Over the Pacific Ocean moving toward the California coast",
			  "70": "Over the California coast traveling inland",
			  "85": "Passing over Los Angeles on the west coast of the United States",
			  "95": "Over Los Angeles approaching Las Vegas in the United States",
			  "110": "Over Las Vegas heading toward Salt Lake City in the United States",
			  "120": "Over the western United States approaching Salt Lake City",
			  "155": "Passing between Salt Lake City and Denver in the United States",
			  "170": "Over the Rocky Mountains in the United States"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT306_139NC_139J_3066_CALI_TO_VEGAS_v08_SDR_PS_20180824_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT306_139NC_139J_3066_CALI_TO_VEGAS_v08_SDR_PS_20180824_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT306_139NC_139J_3066_CALI_TO_VEGAS_v08_SDR_PS_20180824_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "1088217C-1410-4CF7-BDE9-8F573A4DBCD9",
			"accessibilityLabel": "Caribbean",
			"name": "Caribbean to Central America",
			"pointsOfInterest": {
			  "0": "Over the Pacific Ocean moving toward Central America",
			  "70": "The southwest coast of Central America heading toward the Caribbean Sea",
			  "100": "Crossing Central America toward the Caribbean Sea",
			  "150": "Over the Caribbean Sea moving toward Cuba",
			  "240": "Over Cuba with Florida and the Bahamas beyond",
			  "300": "Over Florida and the Bahamas traveling toward the Sargasso Seao",
			  "350": "Over the Sargasso Sea heading out into the Atlantic Ocean"
			},
			"type": "space",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A105_C002_v06_SDR_FINAL_25062018_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A105_C002_v06_SDR_FINAL_25062018_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A105_C002_v06_SDR_FINAL_25062018_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "D5CFB2FF-5F8C-4637-816B-3E42FC1229B8",
			"accessibilityLabel": "Caribbean",
			"name": "Caribbean",
			"pointsOfInterest": {
			  "0": "Traveling over the Pacific Ocean toward Central America",
			  "35": "The Pacific coasts of Nicaragua Costa Rica and Panama",
			  "50": "Passing over Central America with South America in the distance",
			  "65": "The Mosquito Coast of Nicaragua",
			  "85": "Over the Caribbean Sea traveling toward Cuba",
			  "110": "Passing by a cloud-covered Jamaica in the Caribbean Sea",
			  "125": "Crossing over Cuba looking toward Haiti and the Dominican Republic",
			  "170": "Traveling over the Bahamas looking toward Haiti and the Dominican Republic"
			},
			"type": "space",
			"timeOfDay": "day",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A108_C001_v09_SDR_FINAL_22062018_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A108_C001_v09_SDR_FINAL_22062018_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A108_C001_v09_SDR_FINAL_22062018_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "4F881F8B-A7D9-4FDB-A917-17BF6AC5A589",
			"accessibilityLabel": "Caribbean Day",
			"name": "Caribbean Day",
			"pointsOfInterest": {
			  "0": "Heading southeast over the Great Plains of the United States",
			  "90": "Heading southeast over the Midwest United States",
			  "120": "Over the southeast United States heading toward Florida",
			  "220": "Over Florida traveling toward the Bahamas",
			  "240": "Moving southeast over the Bahamas",
			  "285": "Over the Bahamas approaching the Dominican Republic and Haiti",
			  "300": "Over the Dominican Republic and Haiti approaching the Caribbean",
			  "315": "Over the Caribbean Sea heading south toward Venezuela"
			},
			"type": "space",
			"timeOfDay": "day",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT308_139K_142NC_CARIBBEAN_DAY_v09_SDR_FINAL_22062018_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT308_139K_142NC_CARIBBEAN_DAY_v09_SDR_FINAL_22062018_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT308_139K_142NC_CARIBBEAN_DAY_v09_SDR_FINAL_22062018_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "9CCB8297-E9F5-4699-AE1F-890CFBD5E29C",
			"accessibilityLabel": "China",
			"name": "Longji Rice Terraces",
			"pointsOfInterest": { "0": "Passing over the Longji rice terraces in Guangxi Province China" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_CH_C002_C005_PSNK_v05_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_CH_C002_C005_PSNK_v05_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_CH_C002_C005_PSNK_v05_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "D5E76230-81A3-4F65-A1BA-51B8CADED625",
			"accessibilityLabel": "China",
			"name": "Wulingyuan National Park 2",
			"pointsOfInterest": { "0": "Exploring Wulingyuan National Park in China" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_CH_C007_C004_PSNK_v02_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_CH_C007_C004_PSNK_v02_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_CH_C007_C004_PSNK_v02_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "044AD56C-A107-41B2-90CC-E60CCACFBCF5",
			"accessibilityLabel": "China",
			"name": "Great Wall 3",
			"pointsOfInterest": { "0": "The Mutianyu section of the Great Wall in Huairou District China" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_C003_C003_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_C003_C003_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_C003_C003_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "6324F6EB-E0F1-468F-AC2E-A983EBDDD53B",
			"accessibilityLabel": "China",
			"name": "China",
			"pointsOfInterest": {
			  "0": "Over central Asia traveling toward coastal China",
			  "10": "Over central China traveling toward Shanghai",
			  "30": "Heading over eastern China approaching Shanghai",
			  "45": "Approaching Shanghai heading toward the East China Sea",
			  "50": "Over Shanghai moving toward the East China Sea"
			},
			"type": "space",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT329_113NC_396B_1105_CHINA_v04_SDR_FINAL_20180706_F900F2700_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT329_113NC_396B_1105_CHINA_v04_SDR_FINAL_20180706_F900F2700_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT329_113NC_396B_1105_CHINA_v04_SDR_FINAL_20180706_F900F2700_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "B876B645-3955-420E-99DF-60139E451CF3",
			"accessibilityLabel": "China",
			"name": "Wulingyuan National Park 1",
			"pointsOfInterest": { "0": "Traveling through Wulingyuan National Park in China" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_CH_C007_C011_PSNK_v02_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_CH_C007_C011_PSNK_v02_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_CH_C007_C011_PSNK_v02_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "F0236EC5-EE72-4058-A6CE-1F7D2E8253BF",
			"accessibilityLabel": "China",
			"name": "Great Wall 1",
			"pointsOfInterest": { "0": "The Mutianyu section of the Great Wall in Huairou District, China" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_C001_C005_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_C001_C005_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_C001_C005_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "22162A9B-DB90-4517-867C-C676BC3E8E95",
			"accessibilityLabel": "China",
			"name": "Great Wall 2",
			"pointsOfInterest": { "0": "The Mutianyu section of the Great Wall in Huairou District, China" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_C004_C003_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_C004_C003_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_C004_C003_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "CE9B5D5B-B6E7-47C5-8C04-59BF182E98FB",
			"accessibilityLabel": "Costa Rica Dolphins",
			"name": "Costa Rica Dolphins",
			"pointsOfInterest": { "0": "Sea Spinner Dolphins in the waters off of Costa Rica" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/CR_A009_C007_SDR_20191113_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/CR_A009_C007_SDR_20191113_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/CR_A009_C007_SDR_20191113_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "58C75C62-3290-47B8-849C-56A583173570",
			"accessibilityLabel": "Cownose Rays",
			"name": "Cownose Rays",
			"pointsOfInterest": { "0": "Golden Cownose Rays off the coast of Mexico" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/MEX_A006_C008_SDR_20190923_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/MEX_A006_C008_SDR_20190923_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/MEX_A006_C008_SDR_20190923_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "9680B8EB-CE2A-4395-AF41-402801F4D6A6",
			"accessibilityLabel": "Dubai",
			"name": "Approaching Burj Khalifa",
			"pointsOfInterest": {
			  "0": "Approaching Burj Khalifa in Downtown Dubai United Arab Emirates",
			  "280": "Passing by Burj Khalifa in Downtown Dubai, United Arab Emirates",
			  "330": "Over Downtown Dubai approaching the coast"
			},
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_DB_D011_C010_PSNK_DENOISE_v19_SDR_PS_20180914_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D011_C010_PSNK_DENOISE_v19_SDR_PS_20180914_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D011_C010_PSNK_DENOISE_v19_SDR_PS_20180914_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "876D51F4-3D78-4221-8AD2-F9E78C0FD9B9",
			"accessibilityLabel": "Dubai",
			"name": "Sheikh Zayed Road",
			"pointsOfInterest": { "0": "Traveling along Sheikh Zayed Road in Dubai United Arab Emirates" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_DB_D008_C010_PSNK_v21_SDR_PS_20180914_F0F16157_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D008_C010_PSNK_v21_SDR_PS_20180914_F0F16157_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D008_C010_PSNK_v21_SDR_PS_20180914_F0F16157_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "00BA71CD-2C54-415A-A68A-8358E677D750",
			"accessibilityLabel": "Dubai",
			"name": "Downtown",
			"pointsOfInterest": {
			  "0": "Approaching Downtown Dubai in the United Arab Emirates",
			  "210": "Heading over Downtown Dubai in the United Arab Emirates"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_DB_D002_C003_PSNK_v04_SDR_PS_20180914_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D002_C003_PSNK_v04_SDR_PS_20180914_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D002_C003_PSNK_v04_SDR_PS_20180914_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E991AC0C-F272-44D8-88F3-05F44EDFE3AE",
			"accessibilityLabel": "Dubai",
			"name": "Marina 1",
			"pointsOfInterest": { "0": "Flying over Dubai Marina in the United Arab Emirates" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_DB_D001_C001_PSNK_v06_SDR_PS_20180824_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D001_C001_PSNK_v06_SDR_PS_20180824_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D001_C001_PSNK_v06_SDR_PS_20180824_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "3FFA2A97-7D28-49EA-AA39-5BC9051B2745",
			"accessibilityLabel": "Dubai",
			"name": "Marina 2",
			"pointsOfInterest": { "0": "Flying along Dubai Marina in the United Arab Emirates" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_DB_D001_C005_COMP_PSNK_v12_SDR_PS_20180912_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D001_C005_COMP_PSNK_v12_SDR_PS_20180912_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_DB_D001_C005_COMP_PSNK_v12_SDR_PS_20180912_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E334A6D2-7145-47C8-9B00-C20DED08B2D5",
			"accessibilityLabel": "Grand Canyon",
			"name": "Grand Canyon 1",
			"pointsOfInterest": { "0": "Following the Colorado River through the Grand Canyon in the United States" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/G007_C004_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/G007_C004_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/G007_C004_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "DD266E1F-5DF2-4CDB-A2EB-26CE35664657",
			"accessibilityLabel": "Grand Canyon",
			"name": "Grand Canyon 2",
			"pointsOfInterest": { "0": "Flying over the Burnt Canyon area of the Grand Canyon, United States" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/G008_C015_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/G008_C015_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/G008_C015_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "F9F918CD-E15F-4F01-A326-84A44650C5C9",
			"accessibilityLabel": "Grand Canyon",
			"name": "Grand Canyon 3",
			"pointsOfInterest": { "0": "Traveling over the Grand Canyon in the United States" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/G009_C003_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/G009_C003_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/G009_C003_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "AE0115AE-C53B-4DB9-B12F-CA4B7B630CC9",
			"accessibilityLabel": "Grand Canyon",
			"name": "Grand Canyon 4",
			"pointsOfInterest": { "0": "Traveling through the Grand Canyon in the United States" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/G009_C014_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/G009_C014_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/G009_C014_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "8002C4C8-C611-4894-A068-3D3A3C03472A",
			"accessibilityLabel": "Grand Canyon",
			"name": "Grand Canyon 5",
			"pointsOfInterest": { "0": "Traveling along the Colorado River in the Grand Canyon, United States" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/G010_C026_UHD_SDR_v02_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/G010_C026_UHD_SDR_v02_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/G010_C026_UHD_SDR_v02_4K_HEVC.mov"
			}
		  },
		  {
			"id": "3716DD4B-01C0-4F5B-8DD6-DB771EC472FB",
			"accessibilityLabel": "Gray Reef Sharks",
			"name": "Gray Reef Sharks",
			"pointsOfInterest": { "0": "Gray Reef Sharks swimming near French Polynesia" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/FK_U009_C004_SDR_20191220_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/FK_U009_C004_SDR_20191220_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/FK_U009_C004_SDR_20191220_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "2F52E34C-39D4-4AB1-9025-8F7141FAA720",
			"accessibilityLabel": "Greenland",
			"name": "Ilulissat Icefjord",
			"pointsOfInterest": { "0": "The Ilulissat Icefjord off the coast of Greenland" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GL_G002_C002_PSNK_v03_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GL_G002_C002_PSNK_v03_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GL_G002_C002_PSNK_v03_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "B8F204CE-6024-49AB-85F9-7CA2F6DCD226",
			"accessibilityLabel": "Greenland",
			"name": "Nuussuaq Peninsula",
			"pointsOfInterest": { "0": "Traveling along the Nuussuaq Peninsula in Greenland" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GL_G004_C010_PSNK_v04_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GL_G004_C010_PSNK_v04_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GL_G004_C010_PSNK_v04_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "EE01F02D-1413-436C-AB05-410F224A5B7B",
			"accessibilityLabel": "Greenland",
			"name": "Ilulissat Icefjord 2",
			"pointsOfInterest": { "0": "The Ilulissat Icefjord off the coast of Greenland" },
			"type": "landscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GL_G010_C006_PSNK_NOSUN_v12_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GL_G010_C006_PSNK_NOSUN_v12_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GL_G010_C006_PSNK_NOSUN_v12_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "3D729CFC-9000-48D3-A052-C5BD5B7A6842",
			"accessibilityLabel": "Hawaii",
			"name": "Kohala Coastline",
			"pointsOfInterest": { "0": "Following the Kohala coastline on the island of Hawaii" },
			"type": "landscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_H012_C009_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H012_C009_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H012_C009_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "258A6797-CC13-4C3A-AB35-4F25CA3BF474",
			"accessibilityLabel": "Hawaii",
			"name": "Pu‘u O ‘Umi",
			"pointsOfInterest": { "0": "Above the Pu‘u O ‘Umi Natural Area Reserve on the island of Hawaii" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_H004_C009_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H004_C009_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H004_C009_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "499995FA-E51A-4ACE-8DFD-BDF8AFF6C943",
			"accessibilityLabel": "Hawaii",
			"name": "Waimanu Valley",
			"pointsOfInterest": { "0": "The Waimanu Valley in the Kohala Forest Reserve on the island of Hawaii" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_H005_C012_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H005_C012_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H005_C012_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "82BD33C9-B6D2-47E7-9C42-AA3B7758921A",
			"accessibilityLabel": "Hawaii",
			"name": "Pu‘u O ‘Umi",
			"pointsOfInterest": { "0": "Above the Pu‘u O ‘Umi Natural Area Reserve on the island of Hawaii" },
			"type": "landscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_H004_C007_PS_v02_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H004_C007_PS_v02_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H004_C007_PS_v02_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "12E0343D-2CD9-48EA-AB57-4D680FB6D0C7",
			"accessibilityLabel": "Hawaii",
			"name": "Laupāhoehoe Nui",
			"pointsOfInterest": { "0": "Flying over Laupāhoehoe Nui in the Kohala Forest Reserve on the island of Hawaii" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_H007_C003_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H007_C003_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_H007_C003_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E99FA658-A59A-4A2D-9F3B-58E7BDC71A9A",
			"accessibilityLabel": "Hong Kong",
			"name": "Victoria Harbour",
			"pointsOfInterest": { "0": "Over Victoria Harbour heading toward Central Hong Kong" },
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_HK_B005_C011_PSNK_v16_SDR_PS_20180914_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_HK_B005_C011_PSNK_v16_SDR_PS_20180914_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_HK_B005_C011_PSNK_v16_SDR_PS_20180914_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "C8559883-6F3E-4AF2-8960-903710CD47B7",
			"accessibilityLabel": "Hong Kong",
			"name": "Victoria Peak",
			"pointsOfInterest": {
			  "0": "Flying over Victoria Peak in Hong Kong",
			  "150": "Flying over Hong Kong toward Victoria Harbour",
			  "330": "Over Victoria Harbour approaching the Kowloon Peninsulao"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_HK_H004_C010_PSNK_v08_SDR_PS_20181009_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_HK_H004_C010_PSNK_v08_SDR_PS_20181009_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_HK_H004_C010_PSNK_v08_SDR_PS_20181009_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "024891DE-B7F6-4187-BFE0-E6D237702EF0",
			"accessibilityLabel": "Hong Kong",
			"name": "Wan Chai",
			"pointsOfInterest": { "0": "Over Wan Chai approaching Central Hong Kong", "150": "Over Central Hong Kongo", "270": "Over Hong Kong Island" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_HK_H004_C013_t9_6M_HB_tag0.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/HK_H004_C013_2K_SDR_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/HK_H004_C013_4K_SDR_HEVC.mov"
			}
		  },
		  {
			"id": "FE8E1F9D-59BA-4207-B626-28E34D810D0A",
			"accessibilityLabel": "Hong Kong",
			"name": "Victoria Harbour 1",
			"pointsOfInterest": { "0": "Over Victoria Harbour facing Hong Kong Island" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_HK_H004_C008_PSNK_v19_SDR_PS_20180914_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_HK_H004_C008_PSNK_v19_SDR_PS_20180914_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_HK_H004_C008_PSNK_v19_SDR_PS_20180914_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "DD47D8E1-CB66-4C12-BFEA-2ADB0D8D1E2E",
			"accessibilityLabel": "Humpback Whale",
			"name": "Humpback Whale",
			"pointsOfInterest": { "0": "A Humpback Whale off of French Polynesia" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/g201_WH_D004_L014_SDR_20191031_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/g201_WH_D004_L014_SDR_20191031_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/g201_WH_D004_L014_SDR_20191031_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "DDE50C77-B7CB-4488-9EB1-D1B13BF21FFE",
			"accessibilityLabel": "Iceland",
			"name": "Tungnaá",
			"pointsOfInterest": { "0": "Traveling over Tungnaá in the Icelandic highlands" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/I003_C008_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C008_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C008_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E54D5AFE-F362-4D48-A20D-F2C21D2B5330",
			"accessibilityLabel": "Iceland",
			"name": "Jökulgilskvísl River",
			"pointsOfInterest": { "0": "Following the Jökulgilskvísl river in Landmannalaugar, Iceland", "308": "Traveling over the Icelandic highlands" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/I003_C011_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C011_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C011_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "8ACF5D77-B22C-416F-B12A-72FB35E2834F",
			"accessibilityLabel": "Iceland",
			"name": "Landmannalaugar",
			"pointsOfInterest": { "0": "Traveling over Landmannalaugar in Iceland" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/I004_C014_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/I004_C014_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/I004_C014_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "F9518D54-04A7-4793-8666-CFC114D73CE5",
			"accessibilityLabel": "Iceland",
			"name": "Jökulgil",
			"pointsOfInterest": { "0": "Traveling through Jökulgil in Landmannalaugar, Iceland" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/I003_C015_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C015_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C015_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "8590D0C5-E344-4FAC-A39A-FD7BC652AEDA",
			"accessibilityLabel": "Iceland",
			"name": "Langisjór",
			"pointsOfInterest": { "0": "Flying over Langisjór in Iceland" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/I003_C004_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C004_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/I003_C004_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "2F17FCCE-6CCA-4AFA-A08A-C50BF9812DA5",
			"accessibilityLabel": "Iceland",
			"name": "Mýrdalsjökull Glacier",
			"pointsOfInterest": {
			  "0": "Moving toward Mýrdalsjökull glacier in Iceland",
			  "150": "Approaching Mýrdalsjökull glacier in Iceland",
			  "225": "Mýrdalsjökull glacier in Iceland",
			  "324": "Traveling over Mýrdalsjökull glacier in Iceland"
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/I005_C008_CROP_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/I005_C008_CROP_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/I005_C008_CROP_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "F439B0A7-D18C-4B14-9681-6520E6A74FE9",
			"accessibilityLabel": "Iran and Afghanistan",
			"name": "Iran and Afghanistan",
			"pointsOfInterest": {
			  "0": "The reflection of the sun along the coast of Iran",
			  "15": "Moving from day to night over Iran",
			  "60": "Moving from day to night over central Asia"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A083_C002_1130KZ_v04_SDR_PS_FINAL_20180725_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A083_C002_1130KZ_v04_SDR_PS_FINAL_20180725_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A083_C002_1130KZ_v04_SDR_PS_FINAL_20180725_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "7C643A39-C0B2-4BA0-8BC2-2EAA47CC580E",
			"accessibilityLabel": "Ireland to Asia",
			"name": "Ireland to Asia",
			"pointsOfInterest": {
			  "0": "Over the North Atlantic approaching the British Isles",
			  "15": "Ireland and Great Britain",
			  "45": "Over Great Britain traveling toward mainland Europe",
			  "65": "Over northwestern Europe heading toward Russia",
			  "105": "Over central Europe heading toward Russia",
			  "150": "Over eastern Europe with Moscow in the distance",
			  "165": "Over eastern Europe looking toward Moscow",
			  "185": "Over western Russia passing Moscow",
			  "195": "Over Russia traveling toward central Asia"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT329_117NC_401C_1037_IRELAND_TO_ASIA_v48_SDR_PS_FINAL_20180725_F0F6300_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT329_117NC_401C_1037_IRELAND_TO_ASIA_v48_SDR_PS_FINAL_20180725_F0F6300_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT329_117NC_401C_1037_IRELAND_TO_ASIA_v48_SDR_PS_FINAL_20180725_F0F6300_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E5DB138A-F04E-4619-B896-DE5CB538C534",
			"accessibilityLabel": "Italy to Asia",
			"name": "Italy to Asia",
			"pointsOfInterest": {
			  "0": "Over Tunisia heading toward Italy",
			  "5": "Over the Mediterranean Sea looking toward Sicily and the Italian Peninsula",
			  "15": "Over southern Italy with the Balkan Peninsula beyond",
			  "25": "Over the Balkan Peninsula moving toward central Asia",
			  "40": "Over the Balkan Peninsula passing by the Black Sea",
			  "55": "Over Ukraine with Russia beyond",
			  "75": "Over southwest Russia passing by Kazakhstan"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT329_113NC_396B_1105_ITALY_v03_SDR_FINAL_20180706_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT329_113NC_396B_1105_ITALY_v03_SDR_FINAL_20180706_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT329_113NC_396B_1105_ITALY_v03_SDR_FINAL_20180706_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "537A4DAB-83B0-4B66-BCD1-05E5DBB4A268",
			"accessibilityLabel": "Jacks",
			"name": "Jacks",
			"pointsOfInterest": { "0": "A school of Bigeye Jacks off the coast of Borneo" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/BO_A014_C023_SDR_20190717_F240F3709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A014_C023_SDR_20190717_F240F3709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A014_C023_SDR_20190717_F240F3709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "6143116D-03BB-485E-864E-A8CF58ACF6F1",
			"accessibilityLabel": "Kelp",
			"name": "South African Kelp",
			"pointsOfInterest": { "0": "Drifting through a kelp forest near Cape Peninsula South Africa" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/KP_A010_C002_SDR_20190717_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/KP_A010_C002_SDR_20190717_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/KP_A010_C002_SDR_20190717_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "009BA758-7060-4479-8EE8-FB9B40C8FB97",
			"accessibilityLabel": "Korea and Japan Night",
			"name": "Korea and Japan Night",
			"pointsOfInterest": {
			  "0": "Moving southeast over Siberia and Mongolia",
			  "22": "Heading toward Inner Mongolia",
			  "32": "Over Mongolia traveling toward China",
			  "60": "Over northern China moving toward the Korean Peninsula",
			  "110": "Over China heading toward the Korean Peninsula",
			  "150": "The Korean Peninsula with Japan in the distance",
			  "180": "Over South Korea traveling toward Japan",
			  "195": "Over Japan looking toward the Pacific Ocean",
			  "260": "Over the Pacific Ocean southeast of Japan"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT026_363A_103NC_E1027_KOREA_JAPAN_NIGHT_v18_SDR_PS_20180907_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT026_363A_103NC_E1027_KOREA_JAPAN_NIGHT_v18_SDR_PS_20180907_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT026_363A_103NC_E1027_KOREA_JAPAN_NIGHT_v18_SDR_PS_20180907_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "AFA22C08-A486-4CE8-9A13-E355B6C38559",
			"accessibilityLabel": "Liwa",
			"name": "Liwa Oasis 2",
			"pointsOfInterest": { "0": "Flying over Liwa Oasis in the United Arab Emirates" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LW_L001_C003__PSNK_DENOISE_v04_SDR_PS_FINAL_20180803_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LW_L001_C003__PSNK_DENOISE_v04_SDR_PS_FINAL_20180803_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LW_L001_C003__PSNK_DENOISE_v04_SDR_PS_FINAL_20180803_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "001C94AE-2BA4-4E77-A202-F7DE60E8B1C8",
			"accessibilityLabel": "Liwa",
			"name": "Liwa Oasis 1",
			"pointsOfInterest": { "0": "Flying over Liwa Oasis in the United Arab Emirates" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LW_L001_C006_PSNK_DENOISE_v02_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LW_L001_C006_PSNK_DENOISE_v02_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LW_L001_C006_PSNK_DENOISE_v02_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "A5AAFF5D-8887-42BB-8AFD-867EF557ED85",
			"accessibilityLabel": "London",
			"name": "Buckingham Palace",
			"pointsOfInterest": {
			  "0": "Passing over the grounds of Buckingham Palace London",
			  "24": "Over Buckingham Palace in London",
			  "49": "Over St James's Park heading toward the River Thames, London",
			  "104": "Crossing the River Thames and passing over the London Eye",
			  "149": "Passing over South London",
			  "279": "Passing by The Shard in South London",
			  "299": "Crossing the River Thames in London",
			  "324": "Crossing the River Thames at Tower Bridge in London"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_L007_C007_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L007_C007_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L007_C007_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "F604AF56-EA77-4960-AEF7-82533CC1A8B3",
			"accessibilityLabel": "London",
			"name": "River Thames near Sunset",
			"pointsOfInterest": {
			  "0": "Approaching the River Thames in London",
			  "20": "Crossing the River Thames in London",
			  "60": "Passing The Shard in South London",
			  "92": "South of the River Thames heading toward the London Eye",
			  "200": "Crossing the River Thames toward Westminster London",
			  "270": "Over Westminster, London"
			},
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_L012_c002_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L012_c002_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L012_c002_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "58754319-8709-4AB0-8674-B34F04E7FFE2",
			"accessibilityLabel": "London",
			"name": "River Thames",
			"pointsOfInterest": {
			  "0": "Approaching Tower Bridge on the River Thames, London",
			  "78": "Following the River Thames in London",
			  "178": "South of the River Thames in London",
			  "258": "Crossing the River Thames in London"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_L010_C006_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L010_C006_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L010_C006_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "7F4C26C2-67C2-4C3A-8F07-8A7BF6148C97",
			"accessibilityLabel": "London",
			"name": "River Thames at Dusk",
			"pointsOfInterest": {
			  "0": "Approaching Tower Bridge on the River Thames, London",
			  "20": "Following the River Thames in London",
			  "130": "Following the River Thames toward the London Eye",
			  "210": "Approaching the London Eye on the River Thames",
			  "310": "Following the River Thames past the London Eye",
			  "325": "Passing the Houses of Parliament on the River Thames in London"
			},
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_L004_C011_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L004_C011_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_L004_C011_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "92E48DE9-13A1-4172-B560-29B4668A87EE",
			"accessibilityLabel": "Los Angeles",
			"name": "Santa Monica Beach",
			"pointsOfInterest": {
			  "0": "Over Santa Monica State Beach near Los Angeles",
			  "365": "Passing over Santa Monica Pier near Los Angeles",
			  "430": "Over Santa Monica State Beach near Los Angeles"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LA_A008_C004_ALTB_ED_FROM_FLAME_RETIME_v46_SDR_PS_20180917_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A008_C004_ALTB_ED_FROM_FLAME_RETIME_v46_SDR_PS_20180917_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A008_C004_ALTB_ED_FROM_FLAME_RETIME_v46_SDR_PS_20180917_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "35693AEA-F8C4-4A80-B77D-C94B20A68956",
			"accessibilityLabel": "Los Angeles",
			"name": "Harbor Freeway",
			"pointsOfInterest": { "0": "Following Interstate 110 north through Los Angeles" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LA_A005_C009_PSNK_ALT_v09_SDR_PS_201809134_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A005_C009_PSNK_ALT_v09_SDR_PS_201809134_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A005_C009_PSNK_ALT_v09_SDR_PS_201809134_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "F5804DD6-5963-40DA-9FA0-39C0C6E6DEF9",
			"accessibilityLabel": "Los Angeles",
			"name": "Downtown",
			"pointsOfInterest": { "0": "Downtown Los Angeles" },
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LA_A011_C003_DGRN_LNFIX_STAB_v57_SDR_PS_20181002_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A011_C003_DGRN_LNFIX_STAB_v57_SDR_PS_20181002_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A011_C003_DGRN_LNFIX_STAB_v57_SDR_PS_20181002_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "EC67726A-8212-4C5E-83CF-8412932740D2",
			"accessibilityLabel": "Los Angeles",
			"name": "Hollywood Hills",
			"pointsOfInterest": { "0": "The Hollywood Sign in Los Angeles", "250": "Over the Hollywood Hills approaching Burbank California" },
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LA_A006_C004_v01_SDR_FINAL_PS_20180730_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A006_C004_v01_SDR_FINAL_PS_20180730_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A006_C004_v01_SDR_FINAL_PS_20180730_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "CE279831-1CA7-4A83-A97B-FF1E20234396",
			"accessibilityLabel": "Los Angeles",
			"name": "Los Angeles Int’l Airport",
			"pointsOfInterest": { "0": "Heading west over Los Angeles International Airport" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LA_A006_C008_PSNK_ALL_LOGOS_v10_SDR_PS_FINAL_20180801_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A006_C008_PSNK_ALL_LOGOS_v10_SDR_PS_FINAL_20180801_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A006_C008_PSNK_ALL_LOGOS_v10_SDR_PS_FINAL_20180801_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "89B1643B-06DD-4DEC-B1B0-774493B0F7B7",
			"accessibilityLabel": "Los Angeles",
			"name": "Griffith Observatory",
			"pointsOfInterest": { "0": "Griffith Observatory and the Hollywood Hills in Los Angeles" },
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_LA_A009_C009_PSNK_v02_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A009_C009_PSNK_v02_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_LA_A009_C009_PSNK_v02_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "44166C39-8566-4ECA-BD16-43159429B52F",
			"accessibilityLabel": "New York",
			"name": "Seventh Avenue",
			"pointsOfInterest": {
			  "0": "Heading down 7th Avenue toward Times Square New York",
			  "40": "Over Times Square in New York",
			  "120": "Heading down 7th Avenue in Midtown Manhattan, New York"
			},
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_N013_C004_PS_v01_SDR_PS_20180925_F1970F7193_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N013_C004_PS_v01_SDR_PS_20180925_F1970F7193_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N013_C004_PS_v01_SDR_PS_20180925_F1970F7193_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "3BA0CFC7-E460-4B59-A817-B97F9EBB9B89",
			"accessibilityLabel": "New York",
			"name": "Central Park",
			"pointsOfInterest": { "0": "Over Central Park traveling toward Midtown Manhattan in New York", "246": "Over Midtown Manhattan in New York" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_N008_C009_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N008_C009_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N008_C009_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "640DFB00-FBB9-45DA-9444-9F663859F4BC",
			"accessibilityLabel": "New York",
			"name": "Lower Manhattan",
			"pointsOfInterest": {
			  "0": "Approaching Lower Manhattan from New York Harbor",
			  "110": "Alongside Lower Manhattan approaching One World Trade Center",
			  "180": "Passing One World Trade Center toward Midtown Manhattan",
			  "210": "Over Lower Manhattan in New York moving toward Midtown"
			},
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_N008_C003_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N008_C003_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N008_C003_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "840FE8E4-D952-4680-B1A7-AC5BACA2C1F8",
			"accessibilityLabel": "New York",
			"name": "Upper East Side",
			"pointsOfInterest": {
			  "0": "Over the Upper East Side and Central Park in New York",
			  "50": "Over Midtown Manhattan heading downtown toward the Empire State Building",
			  "160": "Approaching the Empire State Building in New York",
			  "205": "Passing the Empire State Building moving toward Lower Manhattan"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_N003_C006_PS_v01_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N003_C006_PS_v01_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_N003_C006_PS_v01_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "B1B5DDC5-73C8-4920-8133-BACCE38A08DE",
			"accessibilityLabel": "New York Night",
			"name": "Mexico City to New York",
			"pointsOfInterest": {
			  "0": "Over the Pacific Ocean heading toward Mexico",
			  "105": "Passing over Mexico City toward the Gulf of Mexico",
			  "122": "Flying over the Gulf of Mexico toward the United States",
			  "180": "Passing by Houston and approaching New Orleans in the United States",
			  "190": "Heading over New Orleans and the Gulf Coast of the United States",
			  "215": "Moving over the southeastern United States",
			  "280": "Over the eastern United States traveling toward New York",
			  "320": "Over the eastern United States approaching New York City"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT307_136NC_134K_8277_NY_NIGHT_01_v25_SDR_PS_20180907_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT307_136NC_134K_8277_NY_NIGHT_01_v25_SDR_PS_20180907_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT307_136NC_134K_8277_NY_NIGHT_01_v25_SDR_PS_20180907_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "78911B7E-3C69-47AD-B635-9C2486F6301D",
			"accessibilityLabel": "New Zealand",
			"name": "New Zealand",
			"pointsOfInterest": {
			  "0": "Crossing from night to day over the South Pacific Ocean",
			  "70": "Crossing from night to day over New Zealand",
			  "110": "Approaching sunrise over New Zealand",
			  "170": "Leaving New Zealand heading northeast over the Pacific Ocean"
			},
			"type": "space",
			"timeOfDay": "day",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A105_C003_0212CT_FLARE_v10_SDR_PS_FINAL_20180711_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A105_C003_0212CT_FLARE_v10_SDR_PS_FINAL_20180711_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A105_C003_0212CT_FLARE_v10_SDR_PS_FINAL_20180711_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "3C4678E4-4D3D-4A40-8817-77752AEA62EB",
			"accessibilityLabel": "Nile Delta",
			"name": "Nile Delta",
			"pointsOfInterest": {
			  "0": "Traveling over Western Europe with the British Isles in the distance",
			  "20": "Heading southeast over the Alps and the Po River Valley",
			  "50": "Moving down the Italian Peninsula and the Adriatic Sea",
			  "100": "Greece flanked by the Ionian and Aegean Seas",
			  "160": "Traveling southeast over the Mediterranean Sea",
			  "185": "The Mediterranean Sea and the Nile River Delta",
			  "205": "The Nile River flowing through the Sahara in Egypt",
			  "220": "The Eastern Desert flanked by the Nile River and the Gulf of Suez",
			  "240": "Heading southeast over the Red Sea"
			},
			"type": "space",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A050_C004_1027V8_v16_SDR_FINAL_20180706_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A050_C004_1027V8_v16_SDR_FINAL_20180706_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A050_C004_1027V8_v16_SDR_FINAL_20180706_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "737E9E24-49BE-4104-9B72-F352DE1AD2BF",
			"accessibilityLabel": "North America Aurora",
			"name": "North America Aurora",
			"pointsOfInterest": {
			  "0": "Over the Pacific Ocean moving toward Baja, California",
			  "45": "Over Baja California looking north toward the United States",
			  "55": "Over Mexico heading toward the southwest United States",
			  "75": "Over the southwest United States",
			  "110": "Over the Rocky Mountains approaching Denver",
			  "125": "Traveling over the Great Plains of the United States",
			  "185": "Approaching the Great Lakes with Ontario, Canada beyond",
			  "200": "Over the Great Lakes approaching Ontario Canada",
			  "210": "The Aurora Borealis over western Ontario, Canada",
			  "235": "The Aurora Borealis over northern Ontario Canadao Turks and Caicos Islands in the Atlantic Ocean",
			  "250": "The Aurora Borealis over northern Quebec Canada",
			  "300": "Heading toward the North Atlantic with the Aurora Borealis over Labrador, Canada"
			},
			"type": "space",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_GMT314_139M_170NC_NORTH_AMERICA_AURORA__COMP_v22_SDR_20181206_v12CC_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT314_139M_170NC_NORTH_AMERICA_AURORA__COMP_v22_SDR_20181206_v12CC_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_GMT314_139M_170NC_NORTH_AMERICA_AURORA__COMP_v22_SDR_20181206_v12CC_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "F07CC61B-30FC-4614-BDAD-3240B61F6793",
			"accessibilityLabel": "Palau Coral",
			"name": "Palau Coral",
			"pointsOfInterest": { "0": "Coral reef near Palauo" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/PA_A004_C003_SDR_20190719_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A004_C003_SDR_20190719_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A004_C003_SDR_20190719_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "BA4ECA11-592F-4727-9221-D2A32A16EB28",
			"accessibilityLabel": "Palau Jellies",
			"name": "Palau Jellies 1",
			"pointsOfInterest": {
			  "0": "Golden Jellyfish in the waters of Palau",
			  "282": "Golden Jellyfish with a Moon Jellyfish in their midst",
			  "348": "Golden Jellyfish in the waters of Palau"
			},
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/PA_A001_C007_SDR_20190717_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A001_C007_SDR_20190717_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A001_C007_SDR_20190717_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E580E5A5-0888-4BE8-A4CA-F74A18A643C3",
			"accessibilityLabel": "Palau Jellies",
			"name": "Palau Jellies 2",
			"pointsOfInterest": { "0": "Golden Jellyfish in the waters of Palau" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/PA_A002_C009_SDR_20190730_ALT01_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A002_C009_SDR_20190730_ALT01_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A002_C009_SDR_20190730_ALT01_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "EC3DC957-D4C2-4732-AACE-7D0C0F390EC8",
			"accessibilityLabel": "Palau Jellies",
			"name": "Palau Jellies 3",
			"pointsOfInterest": { "0": "Golden Jellyfish in the waters of Palauo" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/PA_A010_C007_SDR_20190717_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A010_C007_SDR_20190717_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/PA_A010_C007_SDR_20190717_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "5C987900-AD53-469C-8210-CABBCCDDFCAE",
			"accessibilityLabel": "Patagonia",
			"name": "Cuernos del Paine",
			"pointsOfInterest": { "0": "Moving along Cuernos del Paine in Torres del Paine National Park, Chile" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/P001_C005_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/P001_C005_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/P001_C005_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "B004358B-5A27-42E5-B49E-93FC100B2371",
			"accessibilityLabel": "Patagonia",
			"name": "Lago Nordenskjöld 1",
			"pointsOfInterest": { "0": "Traveling along Lago Nordenskjöld in Torres del Paine National Park, Chile" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/P005_C002_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/P005_C002_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/P005_C002_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "25A6CFB2-3570-4448-B114-244A4E454B7A",
			"accessibilityLabel": "Patagonia",
			"name": "Lago Nordenskjöld 2",
			"pointsOfInterest": { "0": "Over Lago Nordenskjöld in Torres del Paine National Park, Chile" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/P006_C002_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/P006_C002_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/P006_C002_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E5D58CC2-3C52-4206-9DA2-427DC88B5896",
			"accessibilityLabel": "Patagonia",
			"name": "Torres del Paine National Park",
			"pointsOfInterest": { "0": "Traveling over Torres del Paine National Park in Chile" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/P007_C027_UHD_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/P007_C027_UHD_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/P007_C027_UHD_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "82175C1F-153C-4EC8-AE37-2860EA828004",
			"accessibilityLabel": "Red Sea Coral",
			"name": "Red Sea Coral",
			"pointsOfInterest": { "0": "Coral reef in the Red Sea near Egypt" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/RS_A008_C010_SDR_20191218_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/RS_A008_C010_SDR_20191218_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/RS_A008_C010_SDR_20191218_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E556BBC5-D0A0-4DB1-AC77-BC76E4A526F4",
			"accessibilityLabel": "Sahara and Italy",
			"name": "Sahara and Italy",
			"pointsOfInterest": {
			  "0": "Over western Africa moving toward the Saharao",
			  "30": "Crossing the Sahara in North Africa",
			  "110": "Passing over the Ahaggar Mountains in the Sahara, North Africa",
			  "155": "Over the Grand Erg Oriental in North Africa moving toward the Mediterranean Sea",
			  "195": "The coast of Tunisia and the Mediterranean Sea",
			  "210": "Over the coast of Tunisia traveling toward Italy",
			  "230": "Approaching Italy in the Mediterranean Sea",
			  "245": "Over Italy traveling toward the Balkan Peninsula",
			  "285": "Over the Balkan Peninsula heading toward the Carpathian Mountains",
			  "310": "The Carpathian Mountains and the Black Sea"
			},
			"type": "space",
			"timeOfDay": "day",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A009_C001_010181A_v09_SDR_PS_FINAL_20180725_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A009_C001_010181A_v09_SDR_PS_FINAL_20180725_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A009_C001_010181A_v09_SDR_PS_FINAL_20180725_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "72B4390D-DF1D-4D51-B179-229BBAEFFF2C",
			"accessibilityLabel": "San Francisco",
			"name": "Golden Gate from SF",
			"pointsOfInterest": {
			  "0": "Approaching the Golden Gate Bridge from San Francisco",
			  "60": "Alongside the Golden Gate Bridge heading toward the Marin Headlands",
			  "140": "Crossing over the Golden Gate Bridge",
			  "230": "Passing by the North Tower of the Golden Gate Bridge",
			  "260": "Over San Francisco Bay traveling alongside the Golden Gate Bridge"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A013_C012_0122D6_CC_v01_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A013_C012_0122D6_CC_v01_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A013_C012_0122D6_CC_v01_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "3E94AE98-EAF2-4B09-96E3-452F46BC114E",
			"accessibilityLabel": "San Francisco",
			"name": "Bay Bridge",
			"pointsOfInterest": {
			  "0": "Approaching the Bay Bridge and downtown San Francisco",
			  "80": "Crossing over the Bay Bridge heading toward downtown San Francisco",
			  "116": "Over San Francisco Bay heading toward downtown"
			},
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A015_C018_0128ZS_v03_SDR_PS_FINAL_20180709__SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A015_C018_0128ZS_v03_SDR_PS_FINAL_20180709__SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A015_C018_0128ZS_v03_SDR_PS_FINAL_20180709__SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "DE851E6D-C2BE-4D9F-AB54-0F9CE994DC51",
			"accessibilityLabel": "San Francisco",
			"name": "Bay and Golden Gate",
			"pointsOfInterest": {
			  "0": "San Francisco Bay and the Golden Gate Bridge",
			  "140": "Heading over the north tower of the Golden Gate Bridge toward San Francisco",
			  "191": "Over San Francisco Bay"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A006_C003_1219EE_CC_v01_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A006_C003_1219EE_CC_v01_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A006_C003_1219EE_CC_v01_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "4AD99907-9E76-408D-A7FC-8429FF014201",
			"accessibilityLabel": "San Francisco",
			"name": "Bay and Embarcadero",
			"pointsOfInterest": {
			  "0": "Over the San Francisco Bay moving toward the Embarcader",
			  "90": "Over the Embarcadero looking down Market Street in San Francisco",
			  "150": "Following Market Street through downtown San Francisco",
			  "360": "Following Market Street through San Francisco"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_1223LV_FLARE_v21_SDR_PS_FINAL_20180709_F0F5700_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_1223LV_FLARE_v21_SDR_PS_FINAL_20180709_F0F5700_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_1223LV_FLARE_v21_SDR_PS_FINAL_20180709_F0F5700_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "EE533FBD-90AE-419A-AD13-D7A60E2015D6",
			"accessibilityLabel": "San Francisco",
			"name": "Marin Headlands in Fog",
			"pointsOfInterest": {
			  "0": "Over the Marin Headlands looking toward the Golden Gate Bridge",
			  "150": "Crossing the Golden Gate Bridge toward the Presidio of San Francisco"
			},
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A008_C007_011550_CC_v01_SDR_PS_FINAL_20180709_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A008_C007_011550_CC_v01_SDR_PS_FINAL_20180709_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A008_C007_011550_CC_v01_SDR_PS_FINAL_20180709_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "85CE77BF-3413-4A7B-9B0F-732E96229A73",
			"accessibilityLabel": "San Francisco",
			"name": "Embarcadero, Market Street",
			"pointsOfInterest": { "0": "Over San Francisco Bay moving toward the Embarcader", "208": "Following Market Street through San Francisco" },
			"type": "cityscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A012_C014_1223PT_v53_SDR_PS_FINAL_20180709_F0F8700_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A012_C014_1223PT_v53_SDR_PS_FINAL_20180709_F0F8700_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A012_C014_1223PT_v53_SDR_PS_FINAL_20180709_F0F8700_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "29BDF297-EB43-403A-8719-A78DA11A2948",
			"accessibilityLabel": "San Francisco",
			"name": "Fisherman’s Wharf",
			"pointsOfInterest": {
			  "0": "Over Fisherman's Wharf heading toward downtown San Francisco",
			  "80": "Approaching Coit Tower with downtown San Francisco and the Bay Bridge in the background",
			  "150": "Passing Coit Tower toward downtown San Francisco and the Bay Bridge",
			  "196": "Downtown San Francisco"
			},
			"type": "cityscape",
			"timeOfDay": "night",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A007_C017_01156B_v02_SDR_PS_20180925_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A007_C017_01156B_v02_SDR_PS_20180925_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A007_C017_01156B_v02_SDR_PS_20180925_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "0C747C29-4BF8-43F6-A5CC-2E012E555341",
			"accessibilityLabel": "Scotland",
			"name": "Isle of Skye",
			"pointsOfInterest": {
			  "0": "Traveling along the coast of the Isle of Skye, Scotland",
			  "338": "Neist Point Lighthouse, Isle of Skye, Scotland",
			  "372": "Over Victoria Harbour heading toward Central Hong Kong"
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/S003_C020_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/S003_C020_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/S003_C020_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E161929C-0819-4BC2-8359-550C081C7D54",
			"accessibilityLabel": "Scotland",
			"name": "Castle Tioram",
			"pointsOfInterest": {
			  "0": "Loch Moidart on the west coast of Scotland",
			  "139": "Approaching Castle Tioram on the west coast of Scotland",
			  "181": "Castle Tioramon, the west coast of Scotland",
			  "214": "Traveling over the west coast of Scotland"
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/S006_C007_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/S006_C007_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/S006_C007_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "3954A7C4-51EC-4ABC-ABA3-6757AC91C7CF",
			"accessibilityLabel": "Scotland",
			"name": "Loch Moidart",
			"pointsOfInterest": { "0": "Over Loch Moidart on the west coast of Scotland", "252": "Approaching the Sea of Hebrides, Scotland" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/S005_C015_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/S005_C015_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/S005_C015_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "581A4F1A-2B6D-468C-A1BE-6F473F06D10B",
			"accessibilityLabel": "Sea Stars",
			"name": "Sea Stars",
			"pointsOfInterest": { "0": "Horned Sea Stars on the ocean floor near Borneo" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/BO_A012_C031_SDR_20190726_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A012_C031_SDR_20190726_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/BO_A012_C031_SDR_20190726_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "83C65C90-270C-4490-9C69-F51FE03D7F06",
			"accessibilityLabel": "Seals",
			"name": "Seals",
			"pointsOfInterest": { "0": "Cape Fur Seals off the coast of Cape Peninsula, South Africa" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/SE_A016_C009_SDR_20190717_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/SE_A016_C009_SDR_20190717_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/SE_A016_C009_SDR_20190717_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "87060EC2-D006-4102-98CC-3005C68BB343",
			"accessibilityLabel": "South Africa to North Asia",
			"name": "South Africa to North Asia",
			"pointsOfInterest": {
			  "0": "Traveling northeast over the Ethiopian Highlands",
			  "45": "Traveling over the Red Sea into the Arabian Peninsula",
			  "100": "Heading northeast over the Arabian Peninsula",
			  "130": "Over the Arabian Peninsula moving toward Iran",
			  "165": "Over the Arabian Peninsula approaching Iran",
			  "190": "Over Afghanistan and Pakistan moving toward the Karakoram Range",
			  "210": "Over the Zagros Mountains in Iran",
			  "240": "Over the Dasht-e Lut desert in Iran",
			  "265": "Moving toward Turkmenistan and the Garagum desert",
			  "305": "The Amu Darya River and the Pamir-Alay Mountains in central Asia",
			  "322": "The Pamir-Alay Mountains and the Fergana Valley in central Asia",
			  "360": "Heading into southeastern Kazakhstan from Kyrgyzstano",
			  "400": "Traveling north over Kazakhstan",
			  "450": "Over the Altai Mountains moving into Mongolia"
			},
			"type": "space",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A351_C001_v06_SDR_PS_20180725_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A351_C001_v06_SDR_PS_20180725_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A351_C001_v06_SDR_PS_20180725_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "7719B48A-2005-4011-9280-2F64EEC6FD91",
			"accessibilityLabel": "Southern California to Baja",
			"name": "Northern California to Baja",
			"pointsOfInterest": {
			  "0": "Over the Pacific Ocean heading toward the United States",
			  "20": "Traveling south down the coast of California",
			  "50": "Over southern California moving towards Mexico",
			  "65": "Approaching the Mojave Desert in southern California with Mexico beyond",
			  "95": "The Gulf of California flanked by the Sonoran Desert and the Baja California Peninsula",
			  "130": "The Sierra Madre Occidental mountains on the west coast of Mexico",
			  "185": "Over the Sierra Madre Occidental mountains moving toward the west coast of Mexico",
			  "225": "Looking south to the Pacific Ocean over the Sierra Madre del Sur in Mexico",
			  "280": "The Pacific Ocean off the coast of Mexico",
			  "290": "The Pacific Ocean off the coast of Mexico and Guatemalao"
			},
			"type": "space",
			"timeOfDay": "day",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A114_C001_0305OT_v10_SDR_FINAL_22062018_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A114_C001_0305OT_v10_SDR_FINAL_22062018_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A114_C001_0305OT_v10_SDR_FINAL_22062018_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "149E7795-DBDA-4F5D-B39A-14712F841118",
			"accessibilityLabel": "Tahiti Waves",
			"name": "Tahiti Waves 1",
			"pointsOfInterest": { "0": "Waves breaking on the shores of Tahiti" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/g201_TH_803_A001_8_SDR_20191031_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/g201_TH_803_A001_8_SDR_20191031_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/g201_TH_803_A001_8_SDR_20191031_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "8C31B06F-91A4-4F7C-93ED-56146D7F48B9",
			"accessibilityLabel": "Tahiti Waves",
			"name": "Tahiti Waves 2",
			"pointsOfInterest": { "0": "Waves breaking on the shores of Tahiti" },
			"type": "underwater",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/g201_TH_804_A001_8_SDR_20191031_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/g201_TH_804_A001_8_SDR_20191031_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/g201_TH_804_A001_8_SDR_20191031_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "63C042F0-90EF-4A95-B7CC-CC9A64BF8421",
			"accessibilityLabel": "West Africa to the Alps",
			"name": "West Africa to the Alps",
			"pointsOfInterest": {
			  "0": "The Canary Islands Atlantic Ocean and coast of Africa",
			  "45": "Moving north east along the coast of Morocco",
			  "75": "Passing over the Atlas Mountains in Morocco",
			  "105": "Over Morocco approaching the Mediterranean Sea",
			  "125": "The Mediterranean Sea and southern Spain",
			  "145": "Traveling northeast over Spain's Costa Blanca",
			  "165": "Traveling northeast over Spain's Balearic Islands",
			  "185": "Over the western Mediterranean Sea with the Alps beyond",
			  "220": "Moving northeast over the Alps"
			},
			"type": "space",
			"timeOfDay": "day",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/comp_A001_C004_1207W5_v23_SDR_FINAL_20180706_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A001_C004_1207W5_v23_SDR_FINAL_20180706_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/comp_A001_C004_1207W5_v23_SDR_FINAL_20180706_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E5799A24-1949-4E66-A17B-B5EB05F28C5D",
			"accessibilityLabel": "Yosemite",
			"name": "Half Dome and Nevada Fall",
			"pointsOfInterest": {
			  "0": "",
			  "124": "Passing by Half Dome and approaching Nevada Fall in Yosemite National Park",
			  "146": "Half Dome and Nevada Fall in Yosemite National Park, United States"
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/Y004_C015_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/Y004_C015_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/Y004_C015_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E487C6EF-B3FB-427B-A2BE-8CBA60F902F0",
			"accessibilityLabel": "Yosemite",
			"name": "Yosemite 1",
			"pointsOfInterest": {
			  "0": "Over Yosemite National Park in the United States",
			  "40": "Traveling toward Half Dome in Yosemite National Park, United States",
			  "60": "Half Dome in Yosemite National Park, United States",
			  "155": "Over Yosemite National Park with Nevada Fall in the distance",
			  "255": "Nevada and Illilouette Falls in Yosemite National Park, United States",
			  "285": ""
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/Y005_C003_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/Y005_C003_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/Y005_C003_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "E540DEE6-4C40-42C8-9CCC-D4CB0FAD7D7B",
			"accessibilityLabel": "Yosemite",
			"name": "Yosemite 2",
			"pointsOfInterest": { "0": "", "70": "Approaching Half Dome in Yosemite National Park, United States", "87": "", "210": "" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/Y002_C013_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/Y002_C013_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/Y002_C013_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "81CA5ACD-E682-4D8B-A948-0F147EB6ED4F",
			"accessibilityLabel": "Yosemite",
			"name": "Merced Peak",
			"pointsOfInterest": {
			  "0": "Over Yosemite National Park, United States",
			  "93": "Traveling toward Merced Peak in Yosemite National Park, United States",
			  "130": "Merced Peak in Yosemite National Park, United States",
			  "221": "Passing by Merced Peak in Yosemite National Park, United States",
			  "244": "Traveling over Yosemite National Park, United States"
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/Y003_C009_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/Y003_C009_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/Y003_C009_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "4109D42A-D717-46A7-A9A2-FE53A82B25C0",
			"accessibilityLabel": "Yosemite",
			"name": "Yosemite 3",
			"pointsOfInterest": {
			  "0": "Traveling toward Bridalveil Fall and El Capitan in Yosemite National Park",
			  "44": "Traveling east toward El Capitan in Yosemite National Park, United States",
			  "87": "Passing El Capitan, Yosemite National Park, United States",
			  "120": "Traveling east toward Half Dome in Yosemite National Park, United States",
			  "390": "",
			  "470": "Traveling past Half Dome in Yosemite Valley, United States",
			  "585": "Traveling east over Yosemite Valley, United States"
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/Y011_C001_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/Y011_C001_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/Y011_C001_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "DAD82DCE-F3AE-4AEC-8A79-1694D412FC0A",
			"accessibilityLabel": "Yosemite",
			"name": "Tuolumne Meadows",
			"pointsOfInterest": { "0": "Passing over Tuolumne Meadows in Yosemite National Park, United States" },
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/Y009_C015_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/Y009_C015_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/Y009_C015_SDR_4K_HEVC.mov"
			}
		  },
		  {
			"id": "8D04D70F-738B-441D-8D43-AF46B2BF8062",
			"accessibilityLabel": "Yosemite",
			"name": "Matthes Crest",
			"pointsOfInterest": {
			  "0": "Traveling toward Matthes Crest in Yosemite National Park, United States",
			  "75": "",
			  "124": "Flying through Matthes Crest in Yosemite National Park, United States",
			  "215": "Flying over Matthes Crest in Yosemite National Park, United States",
			  "396": "Moving toward Tuolumne Meadows in Yosemite National Park, United States"
			},
			"type": "landscape",
			"src": {
			  "H2641080p": "https://sylvan.apple.com/Videos/Y011_C008_SDR_2K_AVC.mov",
			  "H2651080p": "https://sylvan.apple.com/Aerials/2x/Videos/Y011_C008_SDR_2K_HEVC.mov",
			  "H2654k": "https://sylvan.apple.com/Aerials/2x/Videos/Y011_C008_SDR_4K_HEVC.mov"
			}
		  }
		]
}
