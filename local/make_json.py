from numpy import *
import csv,os



def array_to_js(myarr,myvar):
    # myvar=the output variable name (string)
    n=len(myarr)
    outstr="var "+myvar+"=["
    for i in range(n):
        outstr+='"'+str(myarr[i])+'"'
        if (i < n-1):
            outstr+=","
    outstr+="];\n"
    return outstr

def array_to_dictjs(myarr,myvar):
    # create a javascript dictionary indexed by the values of the arrays.
    # Saves the effort of having to do an indexOf
    n=len(myarr)
    outstr="var "+myvar+"={};\n"
    for i in range(n):
        outstr+=myvar+'["'+myarr[i]+'"]='+str(i)+';\n'
    return outstr

def array_array_dict(myarr1,myarr2,myvar):
    # Starting with two arrays of equal length, make a dictionary, with the
    # first array as keys, and the second array as values
    n=len(myarr1)
    outstr="var "+myvar+"={};\n"
    for i in range(n):
        outstr+=myvar+'["'+myarr1[i]+'"]="'+myarr2[i]+'";\n'
    return outstr

# 0-6: CMTE_ID,CMTE_NM,TRES_NM,CMTE_ST1,CMTE_ST2,CMTE_CITY,CMTE_ST
# 7-10: CMTE_ZIP,CMTE_DSGN,CMTE_TP,CMTE_PTY_AFFILIATION
# 11-14 CMTE_FILING_FREQ,ORG_TP,CONNECTED_ORG_NM,CAND_ID

comm_id=[]
comm_name=[]
comm_cand_id=[] 
comm_descrip=[]

# Retrieve the files:
os.system("wget https://www.fec.gov/files/bulk-downloads/2018/weball18.zip -O weball18.zip")
os.system("unzip -o weball18.zip");

os.system("wget https://www.fec.gov/files/bulk-downloads/2018/cn18.zip -O cn18.zip")
os.system("unzip -o cn18.zip");

os.system("wget https://www.fec.gov/files/bulk-downloads/2018/cm18.zip -O cm18.zip")
os.system("unzip -o cm18.zip");

os.system("wget https://www.fec.gov/files/bulk-downloads/2018/oth18.zip -O oth18.zip")
os.system("unzip -o oth18.zip");

with open('cm.txt', 'r') as f:
    r = csv.reader(f, delimiter='|')
    for c in r:
        if (c[1] != ''):
            comm_id.append(c[0].replace('"',''))
            comm_name.append(c[1].replace('"',''))
            comm_cand_id.append(c[14].replace('"',''))
            comm_descrip.append((c[1]+' ('+c[0]+')').replace('"',''));
f.close()

f=open('committees.json', 'w')
f.write(array_to_js(comm_id,'comm_id'))
f.write(array_to_js(comm_name,'comm_name'))
f.write(array_to_js(comm_cand_id,'comm_cand_id'))
f.write(array_to_js(comm_descrip,'comm_descrip'))
f.write(array_to_dictjs(comm_id,'i_comm_id'))
f.write(array_to_dictjs(comm_name,'i_comm_name'))

f.write('console.log("1 done");\n')
f.close()
os.system('echo "put committees.json" | sftp hostgator:public_html/donors/js')


## Transfers
# 0-6: CMTE_ID,AMNDT_IND,RPT_TP,TRANSACTION_PGI,IMAGE_NUM,TRANSACTION_TP,ENTITY_TP
# 7-10: NAME,CITY,STATE,ZIP_CODE
# 11-14: EMPLOYER,OCCUPATION,TRANSACTION_DT,TRANSACTION_AMT
# 15-20: OTHER_ID,TRAN_ID,FILE_NUM,MEMO_CD,MEMO_TEXT,SUB_ID

tran_amt=[];
tran_id1=[];
tran_id2=[];
#tran_name2=[];
#tran_memo=[];

with open('itoth.txt', 'r') as f:
    r = csv.reader(f, delimiter='|')
    for c in r:
        if ((c[7] != '') and (c[15] != '')):
            tran_id1.append(c[0].replace('"',''))
            tran_id2.append(c[15].replace('"',''))
            tran_amt.append(c[14].replace('"',''))
            #tran_name2.append(c[7].replace('"',''))
            #tran_memo.append(c[19].replace('"',''))
f.close()

f=open('transfers.json','w')
f.write(array_to_js(tran_id1,'tran_id1'));
f.write(array_to_js(tran_id2,'tran_id2'));
f.write(array_to_js(tran_amt,'tran_amt'));
#f.write(array_to_js(tran_name2,'tran_name2'));
#f.write(array_to_js(tran_memo,'tran_memo'));
f.write('console.log("2 done");\n')
f.close()
os.system('echo "put transfers.json" | sftp hostgator:public_html/donors/js')


## Candidates

# 0-6: CAND_ID,CAND_NAME,CAND_PTY_AFFILIATION,CAND_ELECTION_YR,CAND_OFFICE_ST,CAND_OFFICE,CAND_OFFICE_DISTRICT
# 7-10: CAND_ICI,CAND_STATUS,CAND_PCC,CAND_ST1
# 11-14: CAND_ST2,CAND_CITY,CAND_ST,CAND_ZIP
cand_id=[]
cand_name=[]
cand_party=[]
cand_race=[]

with open('cn.txt', 'r') as f:
    r = csv.reader(f, delimiter='|')
    include=1;
    for c in r:
        state=c[4].replace('"','')
        office=c[5].replace('"','')
        if (office == 'S'):
            race=state+"SEN"
        elif (office == 'H'):
            district=c[6].replace('"','')
            if (district == "00"):
                district="AL"
            race=state+'-'+district
        else:
            race='PRES'

        
        cand_id.append(c[0].replace('"',''))
        cand_name.append(c[1].replace('"',''))
        cand_party.append(c[2].replace('"',''))
        cand_race.append(race)
f.close()

# Now compute individual contributions
cand_indiv=zeros(len(cand_id))
with open('weball18.txt', 'r') as f:
    r = csv.reader(f, delimiter='|')
    for c in r:
        id=c[0]
        indiv=c[17]
        idx=cand_id.index(id)
        cand_indiv[idx]=indiv
f.close()

f=open('candidates.json','w')
f.write(array_to_js(cand_id,'cand_id'));
f.write(array_to_js(cand_name,'cand_name'));
f.write(array_to_js(cand_party,'cand_party'));
f.write(array_to_js(cand_race,'cand_race'));
f.write(array_to_js(cand_indiv,'cand_indiv'));
f.write(array_to_dictjs(cand_id,'i_cand_id'));
f.write(array_to_dictjs(cand_name,'i_cand_name'));
#f.write(array_array_dict(cand_id,cand_name,'cand_id_name'));
f.write('console.log("3 done");\n')
f.close()
os.system('echo "put candidates.json" | sftp hostgator:public_html/donors/js')
