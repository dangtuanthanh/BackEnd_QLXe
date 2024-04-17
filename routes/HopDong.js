var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const multer = require('multer');//upload
const xlsx = require('node-xlsx');
const moment = require('moment');
const path = require('path');//xử lý đường dẫn 

const sql = require("../handle/handleHopDong");//load file dboperation

// Middleware kiểm tra và xác thực tên miền truy cập
// const checkDomainAccess = (allowedDomains) => {
//   return (req, res, next) => {
//     const domain = req.headers.origin;
//     if (allowedDomains.includes(domain)) {
//       next();
//     } else {
//       res.status(403).send('Forbidden');
//     }
//   };
// };
// app.use(checkDomainAccess(['https://your-allowed-domain.com']));

//cấu hình cors


router.use(bodyParser.json());//cho phép xử lý dữ liệu gửi lên dạng json
router.use(bodyParser.urlencoded({ extended: false }));//cho phép xử lý dữ liệu gửi lên dạng application/x-www-form-urlencoded
router.get("/HopDong", function (req, res, next) {
  res.render("index", { title: "Trang Quản Lý Hợp Đồng" });
});

/*Quản lý hợp đồng */
// lấy danh sách hợp đồng
router.get("/getContract", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "SoHopDong"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "desc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp
  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getContract')) {
      let result = await sql.getContract();
      const now = new Date();
      result.forEach(item => {
        const date = new Date(item.NgayLamHopDong);
        const date2 = new Date(item.NgayHetHanHopDong);

        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayLamHopDong = formattedDate;
        item.NgayHetHanHopDong = formattedDate2;
        const dateNow = new Date(now).setHours(0, 0, 0, 0);
        const dateEnd = new Date(date2).setHours(0, 0, 0, 0);
        const diffMs = dateNow - dateEnd;
        const diffDays = Math.abs(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if ((diffDays <= 7 && date2 > now) || diffDays == 0) {
          item.SapHetHan = true;
        } else {
          item.SapHetHan = false;
        }
        const diffDaysNoAbs = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        if (diffDaysNoAbs > 0) {
          item.HetHan = true;
        } else {
          item.HetHan = false;
        }
        if (dateEnd >= dateNow) {
          item.ConHan = true;
        } else {
          item.ConHan = false;
        }

      });

      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const resultFilter = result.filter(item => item.MaHopDong == req.query.id);
        //lấy danh sách hợp đồng
        const resultGetList = await sql.getListNormDetailsByID(req.query.id);
        //xử lý ngày tháng cho đúng định dạng
        const newResultGetList = resultGetList.map(item => {
          const date = new Date(item.NgayKiHopDong);
          const date2 = new Date(item.NgayHetHan);
          return {
            ...item,
            NgayKiHopDong: `${date.getFullYear()}-${date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1
              }-${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()
              }`,
            NgayHetHan: `${date2.getFullYear()}-${date2.getMonth() + 1 < 10 ? '0' + (date2.getMonth() + 1) : date2.getMonth() + 1
              }-${date2.getDate() < 10 ? '0' + date2.getDate() : date2.getDate()
              }`
          }
        })
        const newFilteredData = {
          ...resultFilter[0],
          DanhSach: newResultGetList
        };
        res.status(200).json(newFilteredData)
      }
      else {
        if (req.query.searchBy === 'HetHan') {
          // Lọc danh sách
          result = result.filter(item => {
            const nowMoment = moment(now).startOf('day');
            const dateMoment = moment(item.NgayHetHanHopDong, 'DD/MM/YYYY').startOf('day');
            // So sánh với giờ hiện tại
            if (dateMoment.isBefore(nowMoment)) {
              return item;
            }
          });

        } else if (req.query.searchBy === 'ConHan') {
          // Lọc danh sách còn hạn
          result = result.filter(item => {
            const nowMoment = moment(now).startOf('day');
            const dateMoment = moment(item.NgayHetHanHopDong, 'DD/MM/YYYY').startOf('day');
            // So sánh với giờ hiện tại
            if (dateMoment.isAfter(nowMoment) || dateMoment.isSame(nowMoment)) {
              return item;
            }

          });
        } else if (req.query.searchBy === 'SapHetHan') {
          // Lọc danh sách
          result = result.filter(item => {
            const nowMoment = moment(now).startOf('day');
            const endDateMoment = moment(item.NgayHetHanHopDong, 'DD/MM/YYYY').startOf('day');
            // Tính 7 ngày từ hiện tại
            const sevenDaysFromNowMoment = nowMoment.add(7, 'days');
            if (endDateMoment.isBetween(moment(now), sevenDaysFromNowMoment)
              || moment(now).startOf('day').isSame(endDateMoment.startOf('day'), 'day')) {
              return item;
            }
          });
        } else {
          // tính năng tìm kiếm
          if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
            // Danh sách các cột có dữ liệu tiếng Việt
            const vietnameseColumns = ['TenThanhVien'];

            // Lọc dữ liệu
            const filteredData = result.filter((row) => {
              const searchData = req.query.search;
              const searchBy = req.query.searchBy;

              // Lấy giá trị cột tìm kiếm
              const columnData = row[searchBy];

              //kiểm tra tìm kiếm chính xác
              if (searchExact) {
                // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
                const isVietnameseColumn = vietnameseColumns.includes(searchBy);

                // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
                if (isVietnameseColumn) {
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  }

                } else {
                  // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData);
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData);
                  }
                }
              } else {
                if (typeof columnData === 'string') {
                  const lowerCaseColumnData = columnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                }//cột dữ liệu có cột khác string
                else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                  const stringColumnData = String(columnData);
                  const lowerCaseColumnData = stringColumnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                } else if (columnData !== null) {
                  return false;
                }
              }



            });

            // Lưu kết quả lọc vào biến result
            result = filteredData;
          }
        }
        //sắp xếp 
        function compareDate(date1, date2) {
          const mDate1 = moment(date1, 'DD/MM/YYYY');
          const mDate2 = moment(date2, 'DD/MM/YYYY');
          if (mDate1.isBefore(mDate2)) {
            return sortOrder === 'asc' ? -1 : 1;
          }

          if (mDate1.isAfter(mDate2)) {
            return sortOrder === 'asc' ? 1 : -1;
          }
        }
        result.sort((a, b) => {
          if (sortBy === 'TenThanhVien') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else if (sortBy === 'NgayLamHopDong') {
            return compareDate(a.NgayLamHopDong, b.NgayLamHopDong, sortOrder);
          } if (sortBy === 'NgayHetHanHopDong') {
            return compareDate(a.NgayHetHanHopDong, b.NgayHetHanHopDong, sortOrder);
          }
          else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });
        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }
        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('error', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá hợp đồng
router.delete('/deleteContract', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  if (await sql.checkSessionAndRole(ss, 'deleteContract')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deleteContract(ID)
          .catch(error => {
            console.log(error, 'error');
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});
//thêm hợp đồng
router.post('/insertContract', async function (req, res, next) {
  const ss = req.headers.ss;

  if (await sql.checkSessionAndRole(ss, 'insertContract')) {
    if (req.body.MaThanhVien && req.body.DanhSach.length > 0 && req.body.SoHopDong) {
      sql.insertContract(req.body)
        .then(() => {
          res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
        })
        .catch(error => {
          console.log("error", error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//sửa hợp đồng
router.put('/updateContract', async function (req, res, next) {
  const ss = req.headers.ss;
  if (await sql.checkSessionAndRole(ss, 'updateContract')) {
    if (req.body.MaThanhVien && req.body.MaHopDong && req.body.DanhSach.length > 0 && req.body.SoHopDong) {
      sql.updateContract(req.body)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: result.message });
          }
        })
        .catch(error => {
          console.log('error', error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

// lấy danh sách hợp đồng của tôi
router.get("/getMyContract", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "SoHopDong"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "desc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp
  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {

      let result = await sql.viewMyContract(ss);
      const now = new Date();
      result.forEach(item => {
        const date = new Date(item.NgayLamHopDong);
        const date2 = new Date(item.NgayHetHanHopDong);

        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayLamHopDong = formattedDate;
        item.NgayHetHanHopDong = formattedDate2;
        const dateNow = new Date(now).setHours(0, 0, 0, 0);
        const dateEnd = new Date(date2).setHours(0, 0, 0, 0);
        const diffMs = dateNow - dateEnd;
        const diffDays = Math.abs(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        if ((diffDays <= 7 && date2 > now) || diffDays == 0) {
          item.SapHetHan = true;
        } else {
          item.SapHetHan = false;
        }
        const diffDaysNoAbs = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
          if (diffDaysNoAbs > 0) {
            item.HetHan = true;
          } else {
            item.HetHan = false;
          }
          if (dateEnd >= dateNow) {
            item.ConHan = true;
          } else {
            item.ConHan = false;
          }
      });

      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const resultFilter = result.filter(item => item.MaHopDong == req.query.id);
        //lấy danh sách hợp đồng
        const resultGetList = await sql.getListNormDetailsByID(req.query.id);
        //xử lý ngày tháng cho đúng định dạng
        const newResultGetList = resultGetList.map(item => {
          const date = new Date(item.NgayKiHopDong);
          const date2 = new Date(item.NgayHetHan);
          return {
            ...item,
            NgayKiHopDong: `${date.getFullYear()}-${date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1
              }-${date.getDate() < 10 ? '0' + date.getDate() : date.getDate()
              }`,
            NgayHetHan: `${date2.getFullYear()}-${date2.getMonth() + 1 < 10 ? '0' + (date2.getMonth() + 1) : date2.getMonth() + 1
              }-${date2.getDate() < 10 ? '0' + date2.getDate() : date2.getDate()
              }`
          }
        })
        const newFilteredData = {
          ...resultFilter[0],
          DanhSach: newResultGetList
        };
        res.status(200).json(newFilteredData)
      }
      else {
        if (req.query.searchBy === 'HetHan') {
          // Lọc danh sách
          result = result.filter(item => {
            const nowMoment = moment(now);
            const dateMoment = moment(item.NgayHetHanHopDong, 'DD/MM/YYYY');
            // So sánh với giờ hiện tại
            if (dateMoment.isBefore(nowMoment)) {
              return item;
            }
          });
          
        } else if (req.query.searchBy === 'ConHan') {
          // Lọc danh sách còn hạn
          result = result.filter(item => {

            const nowMoment = moment(now).startOf('day');
            const dateMoment = moment(item.NgayHetHanHopDong, 'DD/MM/YYYY').startOf('day');
            // So sánh với giờ hiện tại
            if (dateMoment.isAfter(nowMoment) || dateMoment.isSame(nowMoment)) {
              return item;
            }

          });
        } else if (req.query.searchBy === 'SapHetHan') {
          // Lọc danh sách
          result = result.filter(item => {
            const nowMoment = moment(now).startOf('day');
            const endDateMoment = moment(item.NgayHetHanHopDong, 'DD/MM/YYYY').startOf('day');
            // Tính 7 ngày từ hiện tại
            const sevenDaysFromNowMoment = nowMoment.add(7, 'days');
            if (endDateMoment.isBetween(moment(now), sevenDaysFromNowMoment)
              || moment(now).startOf('day').isSame(endDateMoment.startOf('day'), 'day')) {
              return item;
            }
          });
        }  else {
          // tính năng tìm kiếm
          if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
            // Danh sách các cột có dữ liệu tiếng Việt
            const vietnameseColumns = ['TenThanhVien'];

            // Lọc dữ liệu
            const filteredData = result.filter((row) => {
              const searchData = req.query.search;
              const searchBy = req.query.searchBy;

              // Lấy giá trị cột tìm kiếm
              const columnData = row[searchBy];

              //kiểm tra tìm kiếm chính xác
              if (searchExact) {
                // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
                const isVietnameseColumn = vietnameseColumns.includes(searchBy);

                // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
                if (isVietnameseColumn) {
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                  }

                } else {
                  // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                  if (typeof columnData === 'string') {
                    return columnData.includes(searchData);
                  } else if (columnData !== null) {
                    return String(columnData).includes(searchData);
                  }
                }
              } else {
                if (typeof columnData === 'string') {
                  const lowerCaseColumnData = columnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                }//cột dữ liệu có cột khác string
                else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                  const stringColumnData = String(columnData);
                  const lowerCaseColumnData = stringColumnData.toLowerCase();
                  const lowerCaseSearchData = searchData.toLowerCase();
                  return lowerCaseColumnData.includes(lowerCaseSearchData);
                } else if (columnData !== null) {
                  return false;
                }
              }



            });

            // Lưu kết quả lọc vào biến result
            result = filteredData;
          }
        }
        //sắp xếp 
        function compareDate(date1, date2) {
          const mDate1 = moment(date1, 'DD/MM/YYYY');
          const mDate2 = moment(date2, 'DD/MM/YYYY');
          if (mDate1.isBefore(mDate2)) {
            return sortOrder === 'asc' ? -1 : 1;
          }

          if (mDate1.isAfter(mDate2)) {
            return sortOrder === 'asc' ? 1 : -1;
          }
        }
        result.sort((a, b) => {
          if (sortBy === 'TenThanhVien') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else if (sortBy === 'NgayLamHopDong') {
            return compareDate(a.NgayLamHopDong, b.NgayLamHopDong, sortOrder);
          } if (sortBy === 'NgayHetHanHopDong') {
            return compareDate(a.NgayHetHanHopDong, b.NgayHetHanHopDong, sortOrder);
          }
          else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });
        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }
        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('error', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

//tải danh sách xe theo mã hợp đồng
router.get("/viewMyCar", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp
  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {
      let result = await sql.viewMyCar(req.headers.mahopdong);
      result.forEach(item => {
        const date = new Date(item.NgayMua);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        item.NgayMua = formattedDate;
      });
      //kiểm tra chức năng lấy 1 
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaXe == req.query.id);
        //đăng kiểm
        let resuiltRegistry = await sql.getServiceByIDCar(req.query.id, 'ChiTietDangKiem', 'LanDangKiem', 'NgayDangKiem', 'NgayHetHan');
        //bảo hiểm
        let resuiltInsurance = await sql.getServiceByIDCar(req.query.id, 'ChiTietMuaBaoHiem', 'LanMuaBaoHiem', 'NgayMuaBaoHiem', 'NgayHetHan');
        //phù hiệu
        let resuiltEmblem = await sql.getServiceByIDCar(req.query.id, 'ChiTietPhuHieu', 'LanPhuHieu', 'NgayCapPhuHieu', 'NgayHetHan');
        //định vị
        let resuiltLocate = await sql.getServiceByIDCar(req.query.id, 'ChiTietDinhVi', 'LanMuaDinhVi', 'NgayMua', 'NgayHetHan');
        let resuiltMaintenance = await sql.getServiceByIDCar(req.query.id, 'ChiTietBaoDuong', 'LanBaoDuong', 'NgayBaoDuong', 'NgayBaoDuongTiepTheo');
        let resuiltUsageHistory = await sql.getServiceByIDCar(req.query.id, 'ChiTietSuDung', 'LanSuDung', 'NgayDi', 'NgayVe');

        let resuiltDetailContract = await sql.getDetailContractByIDCar(req.query.id);
        //xử lý đăng kiểm
        const handleRegistry = formatDateResults(resuiltRegistry)
        const handleInsurance = formatDateResults(resuiltInsurance)
        const handleEmblem = formatDateResults(resuiltEmblem)
        const handleLocate = formatDateResults(resuiltLocate)
        const handleMaintenance = formatDateResults(resuiltMaintenance)
        const handleUsageHistory = formatDateResults(resuiltUsageHistory)
        const handleDetailContract = formatDateResults(resuiltDetailContract,true)
        const newFilteredData = {
          ...filteredData[0],
          DangKiem: handleRegistry,
          BaoHiem: handleInsurance,
          PhuHieu: handleEmblem,
          DinhVi: handleLocate,
          BaoDuong: handleMaintenance,
          LichSuSuDung: handleUsageHistory,
          HopDong: handleDetailContract
        };

        res.status(200).json(newFilteredData)
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['NhanHieu', 'TrongTai', 'Mau', 'LinhKien', 'MoTaTinhTrangXe','TenLoaiXe','TenNhomLoaiXe'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'NhanHieu' || sortBy === 'TrongTai' || sortBy === 'Mau' || sortBy === 'LinhKien' || sortBy === 'MoTaTinhTrangXe'|| sortBy === 'TenLoaiXe'|| sortBy === 'TenNhomLoaiXe') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });
        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }
        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi khi tải dữ liệu tài khoản: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
function formatDateResults(results, isHopDong = false) {
  results.forEach(item => {
    const date = new Date(item.Ngay);
    const date2 = new Date(item.NgayHetHan);

    const formattedDate = formatDate(date);
    const formattedDate2 = formatDate(date2);
    if (isHopDong) {
      item.SoHopDong=item.SoHopDong
      item.Lan = item.Lan;
      item.Ngay = formattedDate;
      item.NgayHetHan = formattedDate2;
    } else {
      item.Lan = item.Lan;
      item.Ngay = formattedDate;
      item.NgayHetHan = formattedDate2;
    }
  });

  return results;
}

function formatDate(date) {
  return (`0${date.getDate()}`).slice(-2) + '/' +
    (`0${date.getMonth() + 1}`).slice(-2) + '/' +
    date.getFullYear();
}
// lấy danh sách đăng kiểm theo mã xe
router.get("/viewMyRegistry", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {
      let result = await sql.viewMyRegistry(req.query.id,req.query.id2);
      result.forEach(item => {
        const date = new Date(item.NgayDangKiem);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayDangKiem = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      res.status(200).json(result[0])
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('err', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

router.get("/viewMyInsurance", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {
      let result = await sql.viewMyInsurance(req.query.id,req.query.id2);
      result.forEach(item => {
        const date = new Date(item.NgayMuaBaoHiem);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayMuaBaoHiem = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      res.status(200).json(result[0])
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('err', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

router.get("/viewMyEmblem", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {
      let result = await sql.viewMyEmblem(req.query.id,req.query.id2);
      result.forEach(item => {
        const date = new Date(item.NgayCapPhuHieu);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayCapPhuHieu = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      res.status(200).json(result[0])
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('err', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

router.get("/viewMyLocate", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {
      let result = await sql.viewMyLocate(req.query.id,req.query.id2);
      result.forEach(item => {
        const date = new Date(item.NgayMuaBaoHiem);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayMua = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      res.status(200).json(result[0])
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('err', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

router.get("/viewMyMaintenance", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {
      let result = await sql.viewMyMaintenance(req.query.id,req.query.id2);
      result.forEach(item => {
        const date = new Date(item.NgayBaoDuong);
        const date2 = new Date(item.NgayBaoDuongTiepTheo);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayBaoDuong = formattedDate;
        item.NgayBaoDuongTiepTheo = formattedDate2;
      });
      res.status(200).json(result[0])
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('err', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

router.get("/viewMyUsageHistory", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'viewMyContract')) {
      let result = await sql.viewMyUsageHistory(req.query.id,req.query.id2);
      result.forEach(item => {
        const date = new Date(item.NgayDi);
        const date2 = new Date(item.NgayVe);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayDi = formattedDate;
        item.NgayVe = formattedDate2;
      });
      res.status(200).json(result[0])
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log('err', error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
module.exports = router;
