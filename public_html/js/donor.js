// Plotting variables
var data;
var chart;
var options;

// Current state of the analysis and simple numbers
var iselect;
var isCandidate=false;
var igen=0;
var nc; // Number of committees
var totalAmt;

// Parameters for the session
var ngens=3; // The final one, by definition, is a combination of the candidates and "other"
var ntop=5; // Take the ntop biggest PACs (in the first link) and make them separate.
var ncontrib=4; // The number of contributors (not including individuals) given their own group.
var min_label=100; // The minimum transfer contribution to be included in the tooltip
var doMap=false;

// Empty globals
var iList1; // This is a list of the indices within the comm_XX arrays.
var nodeList1; // By name
var moneyList1; // By amount
var iList2; // The targets
var nodeList2;
var moneyList2; 
var dem_money_house; // The donations to the individual house candidates, by district.
var rep_money_house;

// The pairs of nodes (and money transferred)
// assuming every node is connected to every other.
var name1_arr;
var name2_arr;
var money_arr;

// Some lists/dicts developed dynamically
var comm_group={};
var comm_type={};

//******************************************
// SIMPLE HELPER FUNCTIONS

function getAllIndexes(arr, val) {
    var indexes = [], i = -1;
    while ((i = arr.indexOf(val, i+1)) != -1){
        indexes.push(i);
    }
    return indexes;
}

function sortWithIndices(toSort) {
  for (var i = 0; i < toSort.length; i++) {
    toSort[i] = [toSort[i], i];
  }
  toSort.sort(function(left, right) {
    return left[0] < right[0] ? -1 : 1;
  });
  toSort.sortIndices = [];
  for (var j = 0; j < toSort.length; j++) {
    toSort.sortIndices.push(toSort[j][1]);
    toSort[j] = toSort[j][0];
  }
  return toSort;
}


//*******************************************
// INTERACTION WITH THE HTML

function dosearch() {
    // Now find transfers
    drawChart();
}

function doSelected(i) {
    iselect=i;
    drawChart();
    return false;
}


//*******************************************
// INIT()

function init() {
    $(function() {var availableTags=comm_descrip;
		  $("#tags").autocomplete({
		      source: function(request,response) {
			  var results=$.ui.autocomplete.filter(availableTags, request.term);
			  nmax=20;
			  response(results.slice(0,nmax));
		      },
		      select: function(event,ui) {
			  iselect=$.inArray(ui.item.value, availableTags);
		      },
		      autoFocus: true
		  });
		 });

    // We can take some tags
    var mystr = window.location.toString();
    tags=mystr.split("?");
    for (i=1; i < tags.length; i++) {
	    pair=tags[i].split("=");
	    if (pair[0] == "ntop") {
	        ntop=parseInt(pair[1]);
	    } 
	    if (pair[0] == "ngens") {
	        ngens=parseInt(pair[1]);
	    } 
	    if (pair[0].includes("map")) {
	        console.log("About to draw the map");
	        doMap=true;
	        map_loadAll();
	    }
    }
    google.charts.load("current", {packages:["sankey"]});
    nc=comm_id.length;
}

//**************************************
// Functions to sort through the data

function group_comms() {
    // Create an array of all committees
    // These are the names associated with the 
    // nodes on the chart.
    // We'll pull out the top 'ntop' comms after the first generation
    comm_group={}; // reset
    comm_type={}; //reset
    for (i=0; i < nc; i++) {
        mycand_id=comm_cand_id[i];
        if (mycand_id == ''){
            mygroup='PAC';  
            mytype='PAC';
        } else {
            mygroup=cand_party[i_cand_id[mycand_id]];
            mytype='candidates';
	    }
	    comm_group[comm_name[i]]=mygroup;
	    comm_type[comm_name[i]]=mytype;
    }
    // The selected comm gets assigned by itself to a group
    
    if (comm_type[comm_name[iselect]] == 'candidates') {
        isCandidate=true;
    } else {
        isCandidate=false;
        
    }
    comm_group[comm_name[iselect]]=comm_name[iselect];
    comm_type[comm_name[iselect]]='iselect';
}

function find_top(allTargets) {
    // Using the parameters of the code, let the top comms be their own
    // nodes
    // Create items array
	var items = Object.keys(allTargets).map(function(key) {
	    return [key, allTargets[key]];
	});
	// Sort the array based on the second element
	items.sort(function(first, second) {
	    return second[1] - first[1];
	});
	// Create a new array with only the first 5 items
	nj=Math.min(ntop,items.length);
	for (j=0; j < nj ; j++) {
	   comm_group[items[j][0]]=items[j][0];
	   comm_type[items[j][0]]='individual';
	}
    
}

function includeLink(i1,name1,i2,name2,money0) {
    // Should a particular link be included in the chart? The main requirement is that there be no cycles
    outval=true; // default
    if (i2==iselect) outval=false;
    if (money0 < 0) outval=false;
    if (comm_type[name1] == 'candidates') outval=false;
    if (name2 == null) outval=false;
    //if (typeof(comm_cand_id[i1]) == undefined) outval=false; // This really should be at the beginning of the loop
    return outval;
}

function isLoop(val1,type1,val2,type2) {
    outval=false;
    //i2=i_comm_name[val2];
    if ((type2 == 'individual')&&(igen > 1)) outval=true;
    if ((type1 == 'individual')&&(type2 == 'individual')) outval=true;
    if (type1 == 'candidates') outval=true;
    return outval;
}

//******************************************
// makeGen()
// This is the most important single function
// It takes every node in one generation, and 

function makeGen() {
    //The starting gen is igen
    // ilist1 is alist of the indices (i's in the comm lists) of the LHS objects
    n1=iList1.length;
    
    name2_money={}; // The total money affiliated with "name2"
    
    // The nodes and money transferred for each link     
    name1_arr=[];
    name2_arr=[];
    money_arr=[];
    console.log("starting makeGen");
    for (i=0; i < n1; i++) {
        i1=iList1[i];
        name1=comm_name[i1];
        tList=getAllIndexes(tran_id1,comm_id[iList1[i]]);
        moneyTot=0.;
        iStart=name1_arr.length; // The current value
        for (j=0; j<tList.length; j++ ) {
            id2=tran_id2[tList[j]];
            i2=i_comm_id[id2];
            name2=comm_name[i2];
            //if ((i<10) && (j<100)) console.log(j,tList[j],i2,id2,name2);
            money0=parseFloat(tran_amt[tList[j]]);
            if (includeLink(i1,name1,i2,name2,money0) == true) {
                // Provided we've made it this far...
                isNew=true;
                i1_test=getAllIndexes(name1_arr,name1);
                if (i1_test.length > 0) {
                    for (k=0; k < i1_test.length; k++) {
                        if (name2_arr[i1_test[k]] == name2) {
                            i1_match=i1_test[k];
                            isNew=false;
                        }
                    }
                }
                if (isNew == true) {
                    name1_arr.push(name1);      
                    name2_arr.push(name2);
                    money_arr.push(money0); // This is not the final value of the money, since the previous node only has a finite value
                } else {
                    money_arr[i1_match]+=money0;
                }
                moneyTot+=money0;
            }
        }
        if (igen==0) {
            moneyList1[0]=moneyTot; 
            totalAmt=moneyTot; // for the title
            for (k=0; k< money_arr.length; k++) {
                if (name2_arr[k] in name2_money) {
                    name2_money[name2_arr[k]]+=money_arr[k];
                } else {
                    name2_money[name2_arr[k]]=money_arr[k];
                }
            }
            find_top(name2_money);
        } else {
            for (k=iStart; k < money_arr.length; k++) {
                money_arr[k]=money_arr[k]*moneyList1[i]/moneyTot;
            }
        }
    }   
    // Finally, update the nodes for the next time around.
    nodeList2=[];
    iList2=[];
    moneyList2=[];
    for (k=0; k < money_arr.length; k++) {
        name2=name2_arr[k];
        money2=money_arr[k];
        i2=i_comm_name[name2];
        if (name2 in nodeList2) {
            idx=nodeList2.indexOf(name2);
            moneyList2[idx]+=money2;
        } else {
            nodeList2.push(name2);  
            moneyList2.push(money2);
            iList2.push(i2);
        }
        
    }
}


//*********************************************************************


function drawChart() {
    // Reinitialize all of the arrays
    iList1=[];  nodeList1=[];   moneyList1=[];
    name1_arr=[]; name2_arr=[]; money_arr=[];
    dem_money_house={}; rep_money_house={};
   
    data = new google.visualization.DataTable();
    data.addColumn('string', 'From');
    data.addColumn('string', 'To');
    data.addColumn('number', 'Weight');
    data.addColumn({type: 'string', role: 'tooltip','p': {'html': true}});

    group_comms();
    
    if (isCandidate==true) {
        link_backward();       
    } else {
        link_forward();
    }
}

// The forward version of the link code

function link_forward() {
    for (igen=0; igen < ngens-1; igen++) {
	    if (igen == 0) {
	        iList1.push(iselect); // This is the number in the comm_id list
	        nodeList1.push(comm_name[iselect]) // This is the name of the individual nodes 
	        moneyList1.push(0.); 
	    }
        // empty these again
    	iList2=[];
	    nodeList2=[];
	    moneyList2=[];
    	makeGen();
        
        // Now group and annotate the individual links
	    node1_link=[];
	    node2_link=[];
	    money_link=[];
	    tooltip=[];
	    money_val=[];
	    tip_str=[];
	    tooltip_head=[];

	    for (i=0; i < name1_arr.length; i++) {
	        val1=comm_group[name1_arr[i]];
	        type1=comm_type[name1_arr[i]];
	        val2=comm_group[name2_arr[i]];
	        type2=comm_type[name2_arr[i]];
            if (isLoop(val1,type1,val2,type2) == false) {
                
                if (val1=='PAC') val1='PAC'+igen.toString();
                if (val2=='PAC') val2='PAC'+(igen+1).toString();
                j2=i_comm_name[name2_arr[i]];
		        id=-1;
		        for (j=0; j < node1_link.length; j++) {
		            if ((node1_link[j]==val1) && (node2_link[j]==val2))  id=j;
		        }
    		    if (id >=0) {
	    	        money_link[id]+=money_arr[i];
		            if (money_arr[i] > min_label) {
		                if (money_arr[i] > min_label){
		                    money_val[id].push(money_arr[i]);
		                    tip_str[id].push('&nbsp;<a onclick="doSelected('+j2+')" href="#">'+name2_arr[i].substring(0,40)+'</a><i> $'+parseInt(money_arr[i]).toLocaleString()+'</i><br>');
    			            
		                }
		            }
		            
		        } else {
		            node1_link.push(val1);
		            node2_link.push(val2);
		            money_link.push(money_arr[i]);
		            tooltip_head.push('<b>'+val1+'->'+val2);
		           
    		        tooltip.push('<div style="text-align:left; font-size: 10px; font-family: garamond;">');
		            money_val.push([money_arr[i]]); 
		            tip_str.push(['&nbsp;<a onclick="doSelected('+j2+')" href="#">'+name2_arr[i]+'</a><i> $'+parseInt(money_arr[i]).toLocaleString()+'</i><br>']);
		        }
		        
		        // Do we put the money into a candidate account as well?
		        if (type2 == 'candidates') {
		            name2=name2_arr[i];
		            i2=i_comm_name[name2];
		            k=i_cand_id[comm_cand_id[i2]];
		            myrace=cand_race[k];
		            if (myrace===undefined) myrace='none';
		            if ((myrace.includes('SEN') == false)&&(myrace.includes('PRES')==false)) {
		                if (cand_party[k] == "DEM") {
		                    if (myrace in dem_money_house) {
		                        dem_money_house[myrace]+=money_arr[i];
		                    } else {
		                        dem_money_house[myrace]=money_arr[i];
		                    }
		                    
		                } else if (cand_party[k]== "REP") {
		                    if (myrace in rep_money_house) {
		                        rep_money_house[myrace]+=money_arr[i];
		                    } else {
		                        rep_money_house[myrace]=money_arr[i];
		                    }
		                }
    		            //console.log(val2,name2,k,cand_name[k],cand_race[k]);
		            }
		        }
		        
            }
	    }	    
	       
	    for (j=0; j < node1_link.length; j++) {
	        tooltip_head[j]+=' ($'+parseInt(money_link[j]).toLocaleString()+')</b><br>';
	        
	        
	        tmparr=sortWithIndices(money_val[j]);
	        nk=money_val[j].length;
	        for (k=0; k < nk; k++) {
	            k1=tmparr.sortIndices[nk-k-1];
	            tooltip[j]+=tip_str[j][k1];
	        }
	        
	        
	        tooltip[j]+="</div>";
	        data.addRow([node1_link[j],node2_link[j],money_link[j],tooltip_head[j]+tooltip[j]]);
	    }
	    iList1=iList2.slice();
        nodeList1=nodeList2.slice();
    	moneyList1=moneyList2.slice();
    }
    title_str=comm_name[iselect]+' $'+totalAmt.toLocaleString();
    document.getElementById("chart_title").innerHTML=title_str;

    options = {
	    width: 900,
	    tooltip: {isHtml: true},
	    sankey: {
            node: { label: { fontName: 'Garamond',
                            fontSize: 14,
                            color: '#871b47',
                            bold: true } } },
    };

    
    // Instantiate and draw our chart, passing in some options.
    chart = new google.visualization.Sankey(document.getElementById('chart_div'));
    chart.draw(data, options);
    
    if (doMap == true) {
        map_allInvisible();
        map_changeColorScheme('red_blue');
        moneymax=0.
        for (key in dem_money_house) {
            money=dem_money_house[key];
            if (key in rep_money_house) {
                money+=rep_money_house[key];
            }
            if (money > moneymax) moneymax=money;
        }
        for (key in rep_money_house) {
            money=rep_money_house[key];
            if (money > moneymax) moneymax=money;
        }
        console.log(moneymax);
        
        for (key in dem_money_house) {
            dmoney=dem_money_house[key];
            if (key in rep_money_house) {
                rmoney=rep_money_house[key];
            } else {
                rmoney=0.
            }
            if (key in map_bounds) { // really should be a function
                wgt=Math.sqrt((dmoney+rmoney)/moneymax);
                val=(dmoney)/(dmoney+rmoney);
                map_setVal(key,val);
                map_setWeight(key,wgt);
                map_changeVisible(key,true);
            }
        }
        for (key in rep_money_house) {
            rmoney=rep_money_house[key];
            if ((key in dem_money_house) == false) {
                if (key in map_bounds) {
                    val=0.;
                    wgt=Math.sqrt(rmoney/moneymax);
                    map_setVal(key,val);
                    map_setWeight(key,wgt); 
                    map_changeVisible(key,true);
                }
            }
        }
        
    }
    
    
    
}


// The backward version of the link code
// This has the advantage of only being 1 generation, so no looping.

function link_backward() {
    // This list does not include cash from individuals
    name1_arr=[];
    money_arr=[];

    name2=comm_name[iselect];
    id2=comm_id[iselect];
    id2_cand=comm_cand_id[iselect];
    i2_cand=cand_id.indexOf(id2_cand);
    cand_candidate=cand_name[i2_cand];
    console.log(name2,cand_candidate);
    tList=getAllIndexes(tran_id2,id2);
    moneyTot=0.;
    for (j=0; j < tList.length; j++) {
           id1=tran_id1[tList[j]];
           i1=i_comm_id[id1];
           name1=comm_name[i1];
           money=parseFloat(tran_amt[tList[j]]);
           // Does this name already exist in the name array?
           i1_test=name1_arr.indexOf(name1);
           if (i1_test < 0) {
               name1_arr.push(name1)
               money_arr.push(money);
           } else {
               money_arr[i1_test]+=money;
           }
           moneyTot+=money;
    }
    money_indiv=parseFloat(cand_indiv[i2_cand]);
    moneyTot+=money_indiv;
    totalAmt=moneyTot;

    // Find the top contributors
    idxarr=sortWithIndices(money_arr).sortIndices;
    nk=idxarr.length;
    kmax=Math.min(ncontrib,nk)
    for (k=0; k < kmax; k++) {
        k1=idxarr[nk-k-1]; // Reversed order
        comm_group[name1_arr[k1]]=name1_arr[k1];
        //console.log(k1,name1_arr[k1],money_arr[nk-k-1]);
    }
    // Now create the actual nodes
    node1_link=[];
    node2_link=cand_candidate;
    money_link=[];
    
   
    tooltip=[];
	tooltip_head=[];
	money_val=[];
    
    for (k=0; k < nk; k++) {
        k1=idxarr[nk-k-1]; // Reversed order
        val1=comm_group[name1_arr[k1]];
        i1_test=node1_link.indexOf(val1);
        i1=i_comm_name[name1_arr[k1]];
        if (i1_test < 0) {
            node1_link.push(val1);
            money_link.push(money_arr[nk-k-1])
            
            tooltip_head.push('<b>'+val1+'->'+cand_candidate);
    		tooltip.push('<div style="text-align:left; font-size: 10px; font-family: garamond;">&nbsp;<a onclick="doSelected('+i1+')" href="#">'+name1_arr[k1]+'</a><i> $'+parseInt(money_arr[nk-k-1]).toLocaleString()+'</i><br>');
        } else {
            money_link[i1_test]+=money_arr[nk-k-1];
            tooltip[i1_test]+='&nbsp;<a onclick="doSelected('+i1+')" href="#">'+name1_arr[k1]+'</a><i> $'+parseInt(money_arr[nk-k-1]).toLocaleString()+'</i><br>'
        }
    }
    
    node1_link.push('Individuals');
    money_link.push(parseFloat(cand_indiv[i2_cand]));
    tooltip_head.push('<b>Individual Contributions ->'+cand_candidate);
    tooltip.push('<div>');
    
    // Now chart it up
    
    for (j=0; j< node1_link.length; j++) {
        tooltip_head[j]+=' ($'+parseInt(money_link[j]).toLocaleString()+')</b><br>';
        tooltip[j]+="</div>";
        data.addRow([node1_link[j],node2_link,money_link[j],tooltip_head[j]+tooltip[j]]);

    }
    
    
    title_str=comm_name[iselect]+' $'+totalAmt.toLocaleString();
    document.getElementById("chart_title").innerHTML=title_str;

    options = {
	    width: 900,
	    tooltip: {isHtml: true},
	    sankey: {
            node: { label: { fontName: 'Garamond',
                            fontSize: 14,
                            color: '#871b47',
                            bold: true } } },
    };

    
    // Instantiate and draw our chart, passing in some options.
    chart = new google.visualization.Sankey(document.getElementById('chart_div'));
    chart.draw(data, options);
    
    map_allInvisible();
    // Make the candidate's district visible?
    
    
    
    
}